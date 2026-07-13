import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import {
  UtensilsCrossed, User, CalendarCheck, Star, Heart,
  Camera, Mail, Phone, ArrowLeft, MessageCircle, Bell,
  Globe, CheckCircle, Award, LogOut, X, Share2,
  Clock, ChevronRight, Loader2, QrCode, PartyPopper, MapPin,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../services/api.js";
import { useLang } from "../../context/LanguageContext.jsx";
import { reservationsService } from "../../services/reservations.service.js";
import { eventReservationsService } from "../../services/events.service.js";
import { usersService } from "../../services/users.service.js";
import { notificationsService, chatService } from "../../services/chat.service.js";
import Chat from "../../components/Chat.jsx";

const G = "#E8A045";
const DARK = "#1E2E28";

const LANG_LABELS = { fr: "Français", en: "English", ar: "العربية" };
const LANG_SHORT  = { fr: "FR", en: "EN", ar: "AR" };

const LEVELS = [
  { name: "Bronze",   min: 0,    color: "#CD7F32", bg: "#FDF0E6" },
  { name: "Argent",   min: 500,  color: "#9E9E9E", bg: "#F5F5F5" },
  { name: "Or",       min: 1500, color: "#EF9F27", bg: "#FFFBEC" },
  { name: "Platinum", min: 4000, color: "#185FA5", bg: "#E6F1FB" },
];

const STATUS_COLOR = {
  confirme: "#1D9E75", confirmé: "#1D9E75",
  en_attente: "#854F0B", "en attente": "#854F0B",
  annule: "#993C1D", annulé: "#993C1D",
};
const STATUS_BG = {
  confirme: "#E1F5EE", confirmé: "#E1F5EE",
  en_attente: "#FAEEDA", "en attente": "#FAEEDA",
  annule: "#FAECE7", annulé: "#FAECE7",
};
const STATUS_LABEL = {
  confirme: "Confirmée", confirmé: "Confirmée",
  en_attente: "En attente", "en attente": "En attente",
  annule: "Annulée", annulé: "Annulée",
};

const NOTIF_ICON = {
  reservation: "🗓️",
  message:     "💬",
  promo:       "🎁",
  system:      "⚙️",
  info:        "ℹ️",
};
const NOTIF_COLOR = {
  reservation: "#E1F5EE",
  message:     "#E6F1FB",
  promo:       "#FAEEDA",
  system:      "#f5f5f5",
  info:        "#f5f5f5",
};

const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
  : "—";

// Date + heure pour les réservations (ex: "03 juillet 2026 à 19h00")
const fmtDateTime = (dt) => {
  if (!dt) return "—";
  const d = new Date(dt);
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return `${date} à ${heure}`;
};

const fmtRelative = (dt) => {
  if (!dt) return "";
  const diff = (Date.now() - new Date(dt)) / 1000;
  if (diff < 60)   return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff/60)}min`;
  if (diff < 86400)return `Il y a ${Math.floor(diff/3600)}h`;
  return fmtDate(dt);
};

export default function Profil() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user, logout, refreshUser } = useAuth();
  const { lang, t, changeLang, langs } = useLang();

  // Onglet initial depuis ?tab=xxx
  const urlTab = new URLSearchParams(location.search).get("tab") || "profile";
  const [tab, setTab] = useState(urlTab);

  // Synchroniser l'onglet quand l'URL change (navigation via la barre du bas)
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t) setTab(t);
  }, [location.search]);

  // Photo de profil : liée au COMPTE (user.avatar_url en DB), pas au navigateur
  const [photo,        setPhoto]        = useState(user?.avatar_url || null);
  const [form,         setForm]         = useState({ nom: user?.full_name || "", phone: user?.phone || "" });

  // Synchroniser avec le compte connecté (change quand on change de compte)
  useEffect(() => {
    setPhoto(user?.avatar_url || null);
    setForm({ nom: user?.full_name || "", phone: user?.phone || "" });
  }, [user?.id, user?.avatar_url, user?.full_name, user?.phone]);
  const [saved,        setSaved]        = useState(true);
  const [showLang,     setShowLang]     = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [delPwd,       setDelPwd]       = useState("");
  const [deleting,     setDeleting]     = useState(false);
  const [delError,     setDelError]     = useState("");
  const [reservations, setReservations] = useState([]);
  const [eventResas,   setEventResas]   = useState([]);
  const [qrResa,       setQrResa]       = useState(null); // réservation dont on affiche le QR
  const [loadingR,     setLoadingR]     = useState(true);
  const [favorites,    setFavorites]    = useState(() => {
    try { return JSON.parse(localStorage.getItem("tci_favorites") || "[]"); } catch { return []; }
  });
  const [notifications, setNotifications] = useState([]);
  const [unread,         setUnread]        = useState(0);
  const [loadingN,       setLoadingN]      = useState(true);
  const [conversations,  setConversations] = useState([]);
  const [activeChat,     setActiveChat]    = useState(null); // { id, name }
  const [loadingC,       setLoadingC]      = useState(true);
  const [shareToast,     setShareToast]    = useState(null);
  const fileRef = useRef(null);

  const [points, setPoints] = useState(0);

  // Filtres + pagination de l'onglet réservations
  const [fltYear,  setFltYear]  = useState("");
  const [fltMonth, setFltMonth] = useState("");
  const [fltDay,   setFltDay]   = useState("");
  const [fltResto, setFltResto] = useState("");
  const [resaPage, setResaPage] = useState(1);
  const RESA_PER_PAGE = 10;

  // Charger réservations d'événement (tables / packs VIP) — avec QR de check-in
  useEffect(() => {
    eventReservationsService.listMine()
      .then(d => setEventResas(d?.reservations || []))
      .catch(() => {});
  }, []);

  // Charger réservations
  useEffect(() => {
    reservationsService.myReservations({ limit: 200 })
      .then(res => {
        const list = res.data || [];
        setReservations(list);
        // Points : calcul local en secours immédiat (remplacé par le solde serveur ci-dessous)
        setPoints(list.filter(r => ["confirme","confirmé"].includes(r.status)).length * 50);
      })
      .catch(() => {})
      .finally(() => setLoadingR(false));
  }, []);

  // Solde de fidélité réel (source serveur, cohérent sur tous les appareils)
  useEffect(() => {
    usersService.loyalty()
      .then(d => { if (d && typeof d.points === "number") setPoints(d.points); })
      .catch(() => {}); // en cas d'échec on garde le calcul local
  }, []);

  // Favoris synchronisés au compte (fusion avec le local)
  useEffect(() => {
    usersService.listFavorites()
      .then(rows => {
        if (!Array.isArray(rows)) return;
        const mapped = rows.map(f => ({
          slug: f.slug, name: f.name, ville: f.ville,
          cuisine_type: f.cuisine_type, restaurant_id: f.restaurant_id,
        }));
        setFavorites(mapped);
        try { localStorage.setItem("tci_favorites", JSON.stringify(mapped)); } catch {}
      })
      .catch(() => {});
  }, []);

  // Charger notifications
  useEffect(() => {
    notificationsService.list({ limit: 40 })
      .then(d => { setNotifications(d.notifications || []); setUnread(d.unread || 0); })
      .catch(() => {})
      .finally(() => setLoadingN(false));
  }, []);

  // Charger conversations
  useEffect(() => {
    chatService.getConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoadingC(false));
  }, []);

  const currentLevel = [...LEVELS].reverse().find(l => points >= l.min) || LEVELS[0];
  const nextLevel    = LEVELS[LEVELS.findIndex(l => l.name === currentLevel.name) + 1];
  const progress     = nextLevel
    ? Math.min(100, ((points - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
    : 100;

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Comprimer à max 400px pour éviter les trop gros payloads
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const b64 = canvas.toDataURL("image/jpeg", 0.78);
        setPhoto(b64);
        // Pas de localStorage global : la photo sera persistée en DB
        // (user.avatar_url) à la sauvegarde → propre à chaque compte
        setSaved(false); // ← active le bouton Sauvegarder
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeFavorite = (slug) => {
    const fav = favorites.find(f => f.slug === slug);
    const updated = favorites.filter(f => f.slug !== slug);
    setFavorites(updated);
    localStorage.setItem("tci_favorites", JSON.stringify(updated));
    // Synchroniser la suppression côté serveur si on connaît l'id
    if (fav?.restaurant_id) usersService.removeFavorite(fav.restaurant_id).catch(() => {});
  };

  // Partage réservation via WhatsApp
  const shareReservation = (r) => {
    const text = `🗓️ J'ai réservé une table chez ${r.restaurant_name || r.resto_name} pour le ${fmtDate(r.reserved_at)} (${r.party_size} pers.). Rejoins-moi ! 🍽️\n\nRéf. : ${r.ref}\nVia TablièreCI — tabliereci.net`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setShareToast("Lien WhatsApp ouvert !");
    setTimeout(() => setShareToast(null), 3000);
  };

  const markAllRead = async () => {
    await notificationsService.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const TABS = [
    { id: "profile",       label: t("tab_profile"),      icon: User },
    { id: "reservations",  label: t("tab_reservations"), icon: CalendarCheck },
    { id: "messages",      label: "Messages",            icon: MessageCircle,
      badge: conversations.reduce((a, c) => a + (parseInt(c.unread_count) || 0), 0) },
    { id: "notifications", label: "Notifs",              icon: Bell, badge: unread },
    { id: "rewards",       label: t("tab_rewards"),      icon: Award },
    { id: "saved",         label: t("tab_saved"),        icon: Heart },
  ];

  // ── Filtres + pagination des réservations (client-side) ────────────────────
  const restoOf = (r) => r.restaurant_name || r.resto_name || "—";
  const resaYears = [...new Set(reservations.map(r => r.reserved_at && new Date(r.reserved_at).getFullYear()).filter(Boolean))].sort((a, b) => b - a);
  const resaRestos = [...new Set(reservations.map(restoOf).filter(v => v && v !== "—"))].sort();
  const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  const filteredResas = reservations.filter(r => {
    if (!r.reserved_at) return !(fltYear || fltMonth || fltDay); // sans date : visible seulement sans filtre date
    const d = new Date(r.reserved_at);
    if (fltYear  && d.getFullYear() !== +fltYear)  return false;
    if (fltMonth && (d.getMonth() + 1) !== +fltMonth) return false;
    if (fltDay   && d.getDate() !== +fltDay)       return false;
    if (fltResto && restoOf(r) !== fltResto)       return false;
    return true;
  });
  const resaPageCount = Math.max(1, Math.ceil(filteredResas.length / RESA_PER_PAGE));
  const safeResaPage  = Math.min(resaPage, resaPageCount);
  const pagedResas    = filteredResas.slice((safeResaPage - 1) * RESA_PER_PAGE, safeResaPage * RESA_PER_PAGE);
  const hasResaFilter = fltYear || fltMonth || fltDay || fltResto;
  const resetResaFilters = () => { setFltYear(""); setFltMonth(""); setFltDay(""); setFltResto(""); setResaPage(1); };
  const selStyle = { padding: "8px 10px", borderRadius: 8, border: "0.5px solid #ddd",
    fontSize: 12, background: "white", fontFamily: "inherit", color: "#333", cursor: "pointer" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#f7f7f5", minHeight: "100vh",
      direction: lang === "ar" ? "rtl" : "ltr" }}>

      {/* Toast partage */}
      <AnimatePresence>
        {shareToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
              background: G, color: "white", borderRadius: 20, padding: "8px 18px",
              fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}>
            {shareToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 20px 14px", background: "white",
        borderBottom: "0.5px solid #eee",
        position: "sticky", top: 0, zIndex: 30, flexWrap: "wrap", gap: 8 }}>
        <button onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", cursor: "pointer" }}>
          <ArrowLeft size={15} color="#888" />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: G,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UtensilsCrossed size={13} color="white" />
            </div>
            <span style={{ fontWeight: 600, color: G, fontSize: 15 }}>TablièreCI</span>
          </div>
        </button>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowLang(p => !p)}
              style={{ display: "flex", alignItems: "center", gap: 5, border: "0.5px solid #ddd",
                borderRadius: 8, padding: "6px 10px", background: "white",
                cursor: "pointer", fontSize: 12, color: "#555" }}>
              <Globe size={13} color={G} />
              {LANG_SHORT[lang]}
            </button>
            <AnimatePresence>
              {showLang && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ position: "absolute", top: "calc(100% + 6px)", right: 0,
                    background: "white", border: "0.5px solid #eee", borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,.1)", overflow: "hidden", minWidth: 140, zIndex: 100 }}>
                  {langs.map(l => (
                    <button key={l} onClick={() => { changeLang(l); setShowLang(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "9px 14px", border: "none",
                        background: l === lang ? "#E1F5EE" : "white",
                        cursor: "pointer", fontSize: 13,
                        color: l === lang ? G : "#444", fontWeight: l === lang ? 500 : 400 }}>
                      {LANG_SHORT[l]} · {LANG_LABELS[l]}
                      {l === lang && <CheckCircle size={12} color={G} style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={async () => { await logout(); navigate("/"); }}
            style={{ display: "flex", alignItems: "center", gap: 5, border: "0.5px solid #eee",
              borderRadius: 8, padding: "6px 12px", background: "white",
              cursor: "pointer", fontSize: 12, color: "#888" }}>
            <LogOut size={13} /> {t("nav_logout")}
          </button>
        </div>
      </nav>

      {/* Header profil */}
      <div style={{ background: DARK, padding: "24px 20px 52px", textAlign: "center" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#9FE1CB",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", border: "3px solid white" }}>
            {photo
              ? <img src={photo} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <User size={32} color="white" />
            }
          </div>
          <button onClick={() => fileRef.current?.click()}
            style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24,
              borderRadius: "50%", background: G, border: "2px solid white",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Camera size={11} color="white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        </div>
        <div style={{ color: "white", fontWeight: 600, fontSize: 17, marginTop: 10 }}>
          {user?.full_name || "—"}
        </div>
        <div style={{ color: "#9FE1CB", fontSize: 12, marginTop: 2 }}>{user?.email}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
          background: currentLevel.bg, borderRadius: 20, padding: "4px 12px" }}>
          <Award size={12} color={currentLevel.color} />
          <span style={{ fontSize: 11, fontWeight: 500, color: currentLevel.color }}>
            {currentLevel.name} — {points} pts
          </span>
        </div>
      </div>

      {/* Tabs — scrollable sur mobile */}
      <div style={{ display: "flex", background: "white", borderBottom: "0.5px solid #eee",
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none", position: "relative", marginTop: -28 + "px" }}>
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "13px 14px",
              border: "none", background: "transparent", cursor: "pointer", whiteSpace: "nowrap",
              fontSize: 12, fontWeight: tab === id ? 600 : 400,
              color: tab === id ? G : "#888",
              borderBottom: tab === id ? `2px solid ${G}` : "2px solid transparent",
              position: "relative", flexShrink: 0 }}>
            <Icon size={13} />{label}
            {badge > 0 && (
              <span style={{ position: "absolute", top: 8, right: 6, background: "#DC2626",
                color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 9,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div style={{ maxWidth: 720, margin: "0 auto",
        padding: "16px 16px calc(100px + env(safe-area-inset-bottom, 0px))" }}>

        {/* ── PROFIL ─────────────────────────────────────────────────────── */}
        {tab === "profile" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
              padding: "18px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                {t("profile_title")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label={t("profile_name")} icon={User}
                  value={form.nom} onChange={v => { setForm(p => ({ ...p, nom: v })); setSaved(false); }} />
                <Field label={t("profile_email")} icon={Mail} value={user?.email || ""} readOnly />
                <Field label={t("profile_phone")} icon={Phone}
                  value={form.phone} onChange={v => { setForm(p => ({ ...p, phone: v })); setSaved(false); }}
                  placeholder="+225 07 00 00 00" />
              </div>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  try {
                    const payload = {
                      full_name:  form.nom   || undefined,
                      phone:      form.phone || undefined,
                      avatar_url: photo      || undefined,
                    };
                    await api.patch("/users/me", payload);
                    // Photo persistée en DB (user.avatar_url) — propre au compte.
                    // Recharger le user pour synchroniser avatar dans toute l'app.
                    await refreshUser?.();
                    setSaved(true);
                  } catch (e) {
                    alert(e.response?.data?.message || "Erreur lors de la sauvegarde");
                  }
                }}
                style={{ marginTop: 16, background: G, color: "white", border: "none",
                  borderRadius: 9, padding: "11px 0", width: "100%", fontSize: 14,
                  fontWeight: 600, cursor: saved ? "default" : "pointer", opacity: saved ? 0.5 : 1 }}
                disabled={saved}>
                {saved ? "✓ Enregistré" : t("profile_save")}
              </motion.button>
            </div>

            <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
              padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t("profile_contact")}</div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>
                {t("profile_contact_desc")}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="https://wa.me/2250700000000" target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#E1F5EE",
                    color: G, borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <a href="mailto:support@tabliereci.net"
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f5f5",
                    color: "#555", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                  <Mail size={14} /> Email
                </a>
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
              padding: "16px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                <Globe size={14} style={{ verticalAlign: "middle", marginRight: 6, color: G }} />
                {t("lang_label")}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {langs.map(l => (
                  <button key={l} onClick={() => changeLang(l)}
                    style={{ flex: 1, minWidth: 80, padding: "9px 0", borderRadius: 9, cursor: "pointer",
                      border: `1.5px solid ${l === lang ? G : "#eee"}`,
                      background: l === lang ? "#E1F5EE" : "white",
                      color: l === lang ? G : "#555", fontWeight: l === lang ? 600 : 400, fontSize: 12 }}>
                    {LANG_SHORT[l]} · {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Zone de danger : suppression du compte ── */}
            <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #f0d9d9",
              padding: "16px 18px", marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#b3261e" }}>
                Supprimer mon compte
              </div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>
                La suppression retire définitivement vos données personnelles (nom, e-mail, téléphone)
                et vous déconnecte. Cette action est irréversible.
              </div>
              <button onClick={() => { setDelError(""); setDelPwd(""); setShowDelete(true); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fdeceb",
                  color: "#b3261e", border: "1px solid #f0c9c6", borderRadius: 9, padding: "9px 16px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <X size={14} /> Supprimer mon compte
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Modale de confirmation de suppression ── */}
        <AnimatePresence>
          {showDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !deleting && setShowDelete(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.5)", zIndex: 1000,
                display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                style={{ background: "white", borderRadius: 16, padding: 22, maxWidth: 380, width: "100%",
                  boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#b3261e", marginBottom: 8 }}>
                  Supprimer définitivement le compte ?
                </div>
                <div style={{ fontSize: 13.5, color: "#666", lineHeight: 1.55, marginBottom: 16 }}>
                  Vos données personnelles seront supprimées et vous serez déconnecté immédiatement.
                  Saisissez votre mot de passe pour confirmer.
                </div>
                <input type="password" value={delPwd} onChange={e => setDelPwd(e.target.value)}
                  placeholder="Votre mot de passe" autoFocus
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #ddd",
                    fontSize: 15, outline: "none", boxSizing: "border-box" }} />
                {delError && (
                  <div style={{ fontSize: 12.5, color: "#b3261e", marginTop: 8 }}>{delError}</div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button onClick={() => setShowDelete(false)} disabled={deleting}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #ddd",
                      background: "white", color: "#555", fontSize: 14, fontWeight: 600,
                      cursor: deleting ? "default" : "pointer" }}>
                    Annuler
                  </button>
                  <button disabled={deleting || !delPwd}
                    onClick={async () => {
                      setDeleting(true); setDelError("");
                      try {
                        await api.delete("/users/me", { data: { password: delPwd } });
                        await logout();
                        navigate("/");
                      } catch (e) {
                        setDelError(e.response?.data?.message || "Mot de passe incorrect ou erreur.");
                        setDeleting(false);
                      }
                    }}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                      background: "#b3261e", color: "white", fontSize: 14, fontWeight: 700,
                      cursor: (deleting || !delPwd) ? "default" : "pointer", opacity: (deleting || !delPwd) ? 0.6 : 1 }}>
                    {deleting ? "Suppression…" : "Supprimer"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RÉSERVATIONS ───────────────────────────────────────────────── */}
        {tab === "reservations" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* ── Réservations d'événement (tables / VIP) avec QR de check-in ── */}
            {eventResas.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 10 }}>
                  <PartyPopper size={15} color={G} /> Mes événements
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {eventResas.map(r => {
                    const stColor = r.status === "confirme" ? "#1D9E75" : r.status === "annule" ? "#DC2626" : r.status === "termine" ? "#9BA89F" : "#C47D1A";
                    const stLabel = r.status === "confirme" ? "Confirmée" : r.status === "annule" ? "Annulée" : r.status === "termine" ? "Terminée" : "En attente";
                    return (
                      <div key={r.id} style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{r.event_name}</div>
                          <div style={{ fontSize: 12, color: "#888", display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3, alignItems: "center" }}>
                            <span style={{ fontFamily: "monospace" }}>{r.ref}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {fmtDateTime(r.starts_at)}</span>
                            {r.table_label && <span>{r.table_kind === "vip" ? "VIP · " : ""}{r.table_label}</span>}
                            <span>{r.party_size} pers.</span>
                          </div>
                          <span style={{ display: "inline-block", marginTop: 7, fontSize: 10.5, fontWeight: 700, color: stColor,
                            background: stColor + "18", borderRadius: 6, padding: "2px 8px" }}>{stLabel}</span>
                        </div>
                        {r.status !== "annule" && (
                          <button onClick={() => setQrResa(r)}
                            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "0.5px solid #eee",
                              borderRadius: 10, padding: "8px 12px", background: "#FEF6EC", color: "#C47D1A", cursor: "pointer",
                              fontSize: 10.5, fontWeight: 700, touchAction: "manipulation" }}>
                            <QrCode size={20} /> QR
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t("reserv_title")}</div>
            {loadingR ? (
              <Loading />
            ) : reservations.length === 0 ? (
              <EmptyState icon={CalendarCheck} title={t("reserv_empty")} sub={t("reserv_empty_sub")}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/")}
                  style={{ marginTop: 16, background: G, color: "white", border: "none",
                    borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Voir les restaurants
                </motion.button>
              </EmptyState>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* ── Filtres ── */}
                <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
                  padding: "12px 12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                    <select value={fltYear} onChange={e => { setFltYear(e.target.value); setResaPage(1); }} style={selStyle}>
                      <option value="">Toutes années</option>
                      {resaYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={fltMonth} onChange={e => { setFltMonth(e.target.value); setResaPage(1); }} style={selStyle}>
                      <option value="">Tous les mois</option>
                      {MONTHS_FR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={fltDay} onChange={e => { setFltDay(e.target.value); setResaPage(1); }} style={selStyle}>
                      <option value="">Tous les jours</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={fltResto} onChange={e => { setFltResto(e.target.value); setResaPage(1); }} style={selStyle}>
                      <option value="">Tous les restaurants</option>
                      {resaRestos.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                    <span style={{ fontSize: 11, color: "#999" }}>
                      {filteredResas.length} réservation{filteredResas.length > 1 ? "s" : ""}
                    </span>
                    {hasResaFilter && (
                      <button onClick={resetResaFilters}
                        style={{ fontSize: 11, color: G, border: "none", background: "transparent",
                          cursor: "pointer", fontWeight: 600 }}>
                        ✕ Réinitialiser
                      </button>
                    )}
                  </div>
                </div>

                {filteredResas.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#999", fontSize: 13, padding: "24px 0" }}>
                    Aucune réservation ne correspond à ces filtres.
                  </div>
                ) : pagedResas.map((r, i) => (
                  <div key={r.id || r.ref || i} style={{ background: "white", borderRadius: 14,
                    border: "0.5px solid #eee", padding: "13px 14px" }}>
                    <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
                      {/* Vignette photo du restaurant (ou icône par défaut) */}
                      <div style={{ width: 78, height: 78, borderRadius: 14, overflow: "hidden",
                        background: "#E1F5EE", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0 }}>
                        {(r.restaurant_photo || r.cover_url || r.logo_url || r.photo_url)
                          ? <img src={r.restaurant_photo || r.cover_url || r.logo_url || r.photo_url} alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <UtensilsCrossed size={26} color={G} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1E2E28" }}>
                          {r.restaurant_name || r.resto_name || "—"}
                        </div>
                        {/* Badge statut avec icône */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5,
                          background: STATUS_BG[r.status] || "#f5f5f5",
                          color: STATUS_COLOR[r.status] || "#666",
                          borderRadius: 8, padding: "4px 10px", fontSize: 11.5, fontWeight: 700,
                          marginTop: 5 }}>
                          {["confirme", "confirmé"].includes(r.status)
                            ? <CheckCircle size={13} /> : <Clock size={13} />}
                          {STATUS_LABEL[r.status] || r.status}
                        </div>
                        {/* Date */}
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8,
                          fontSize: 12.5, color: "#5c574f" }}>
                          <CalendarCheck size={14} color="#b6b1a8" /> {fmtDateTime(r.reserved_at)}
                        </div>
                        {/* Convives */}
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4,
                          fontSize: 12.5, color: "#5c574f" }}>
                          <User size={14} color="#b6b1a8" /> {r.party_size} personne{r.party_size > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => shareReservation(r)}
                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11,
                          border: "0.5px solid #eee", borderRadius: 8, padding: "5px 10px",
                          background: "white", cursor: "pointer", color: "#555" }}>
                        <Share2 size={11} /> Inviter sur WhatsApp
                      </button>
                      {r.id && (
                        <button onClick={() => { setActiveChat({ id: r.id, name: r.restaurant_name || r.resto_name }); setTab("messages"); }}
                          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11,
                            border: "0.5px solid #E1F5EE", borderRadius: 8, padding: "5px 10px",
                            background: "#E1F5EE", cursor: "pointer", color: G }}>
                          <MessageCircle size={11} /> Contacter le resto
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* ── Pagination (10 / page) ── */}
                {filteredResas.length > RESA_PER_PAGE && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 10, marginTop: 6 }}>
                    <button onClick={() => setResaPage(p => Math.max(1, p - 1))} disabled={safeResaPage === 1}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "0.5px solid #ddd",
                        background: "white", cursor: safeResaPage === 1 ? "default" : "pointer",
                        opacity: safeResaPage === 1 ? 0.45 : 1, fontSize: 12 }}>
                      Précédent
                    </button>
                    <span style={{ fontSize: 12, color: "#888" }}>
                      Page {safeResaPage} / {resaPageCount}
                    </span>
                    <button onClick={() => setResaPage(p => Math.min(resaPageCount, p + 1))} disabled={safeResaPage === resaPageCount}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "0.5px solid #ddd",
                        background: "white", cursor: safeResaPage === resaPageCount ? "default" : "pointer",
                        opacity: safeResaPage === resaPageCount ? 0.45 : 1, fontSize: 12 }}>
                      Suivant
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── MESSAGES / CHAT ─────────────────────────────────────────────── */}
        {tab === "messages" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {activeChat ? (
              <div style={{ height: "calc(100vh - 240px)", minHeight: 400 }}>
                <button onClick={() => setActiveChat(null)}
                  style={{ display: "flex", alignItems: "center", gap: 5, border: "none",
                    background: "transparent", cursor: "pointer", color: "#888", fontSize: 12,
                    marginBottom: 10 }}>
                  <ArrowLeft size={13} /> Toutes les conversations
                </button>
                <Chat
                  reservationId={activeChat.id}
                  otherName={activeChat.name}
                  onClose={() => setActiveChat(null)}
                />
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Messages</div>
                {loadingC ? <Loading /> :
                 conversations.length === 0 ? (
                  <EmptyState icon={MessageCircle} title="Aucun message"
                    sub="Contactez un restaurant depuis une réservation pour démarrer une conversation." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {conversations.map((c, i) => (
                      <motion.div key={i} whileHover={{ x: 2 }} onClick={() =>
                        setActiveChat({ id: c.reservation_id, name: c.resto_name || c.client_name })}
                        style={{ background: "white", borderRadius: 12, border: "0.5px solid #eee",
                          padding: "12px 14px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E1F5EE",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <MessageCircle size={17} color={G} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {c.resto_name || c.client_name}
                          </div>
                          <div style={{ fontSize: 12, color: "#999",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.last_message || "Nouvelle conversation"}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <div style={{ fontSize: 10, color: "#bbb" }}>
                            {c.last_message_at ? fmtRelative(c.last_message_at) : ""}
                          </div>
                          {parseInt(c.unread_count) > 0 && (
                            <span style={{ background: "#DC2626", color: "white",
                              borderRadius: "50%", width: 18, height: 18, fontSize: 10,
                              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── NOTIFICATIONS ──────────────────────────────────────────────── */}
        {tab === "notifications" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Notifications</div>
              {unread > 0 && (
                <button onClick={markAllRead}
                  style={{ fontSize: 12, color: G, border: "none", background: "transparent",
                    cursor: "pointer", fontWeight: 500 }}>
                  Tout marquer comme lu
                </button>
              )}
            </div>
            {loadingN ? <Loading /> :
             notifications.length === 0 ? (
              <EmptyState icon={Bell} title="Aucune notification" sub="Vos notifications apparaîtront ici." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {notifications.map((n, i) => (
                  <motion.div key={i} whileHover={{ x: 2 }}
                    onClick={async () => {
                      if (!n.is_read) {
                        await notificationsService.markOneRead(n.id);
                        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
                        setUnread(u => Math.max(0, u - 1));
                      }
                    }}
                    style={{ background: n.is_read ? "white" : "#F0FAF6",
                      borderRadius: 12, border: `0.5px solid ${n.is_read ? "#eee" : "#B8E8D4"}`,
                      padding: "12px 14px", cursor: "pointer",
                      display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10,
                      background: NOTIF_COLOR[n.type] || "#f5f5f5",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, flexShrink: 0 }}>
                      {NOTIF_ICON[n.type] || "📣"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                      {n.body && (
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2, lineHeight: 1.4 }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "#bbb", marginTop: 4 }}>
                        {fmtRelative(n.created_at)}
                      </div>
                    </div>
                    {!n.is_read && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%",
                        background: G, flexShrink: 0, marginTop: 4 }} />
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── REWARDS ────────────────────────────────────────────────────── */}
        {tab === "rewards" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ background: currentLevel.bg, borderRadius: 14,
              border: `1px solid ${currentLevel.color}33`, padding: "20px 18px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Award size={26} color={currentLevel.color} />
                <div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t("rewards_level")}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: currentLevel.color }}>
                    {currentLevel.name}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: currentLevel.color }}>{points}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t("rewards_points")}</div>
                </div>
              </div>
              {nextLevel && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    fontSize: 10, color: "#888", marginBottom: 4 }}>
                    <span>{currentLevel.name}</span>
                    <span>{nextLevel.name} à {nextLevel.min} pts</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: "#ddd", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, background: currentLevel.color,
                      width: `${progress}%`, transition: "width 0.8s" }} />
                  </div>
                </>
              )}
            </div>

            {LEVELS.map((lvl, i) => (
              <div key={i} style={{ background: "white", borderRadius: 12,
                border: `0.5px solid ${lvl.name === currentLevel.name ? lvl.color + "66" : "#eee"}`,
                padding: "12px 14px", marginBottom: 8, opacity: points >= lvl.min ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Award size={14} color={lvl.color} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: lvl.color }}>{lvl.name}</span>
                  <span style={{ fontSize: 11, color: "#aaa", marginLeft: "auto" }}>dès {lvl.min} pts</span>
                </div>
                <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                  {i === 0 && "Accès à la plateforme · Réservations en ligne"}
                  {i === 1 && "Priorité de réservation"}
                  {i === 2 && "Accès aux offres exclusives · Support prioritaire"}
                  {i === 3 && "Accès VIP · Concierge dédié"}
                </div>
              </div>
            ))}

            <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "10px 12px",
              fontSize: 12, color: "#999", textAlign: "center" }}>
              Vous gagnez <strong>50 points</strong> par réservation confirmée
            </div>
          </motion.div>
        )}

        {/* ── RESTAURANTS SAUVEGARDÉS ─────────────────────────────────────── */}
        {tab === "saved" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t("saved_title")}</div>
            {favorites.length === 0 ? (
              <EmptyState icon={Heart} title={t("saved_empty")} sub={t("saved_empty_sub")}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/")}
                  style={{ marginTop: 16, background: G, color: "white", border: "none",
                    borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Voir les restaurants
                </motion.button>
              </EmptyState>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {favorites.map((fav, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 14,
                    border: "0.5px solid #eee", padding: "12px 14px",
                    display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "#E1F5EE",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <UtensilsCrossed size={18} color={G} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{fav.name}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{fav.ville} · {fav.cuisine_type}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => navigate(`/restaurants/${fav.slug}`)}
                        style={{ border: "0.5px solid #E1F5EE", borderRadius: 8, padding: "5px 10px",
                          background: "#E1F5EE", cursor: "pointer", fontSize: 11, color: G, fontWeight: 500 }}>
                        Voir
                      </button>
                      <button onClick={() => removeFavorite(fav.slug)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ccc", padding: 4 }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Modale QR de check-in événement ── */}
      {qrResa && createPortal(
        <div onClick={() => setQrResa(null)}
          style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(30,46,40,.55)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 18, padding: "26px 24px", width: "100%", maxWidth: 340,
              textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>{qrResa.event_name}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 3, marginBottom: 18 }}>
              {fmtDateTime(qrResa.starts_at)}{qrResa.table_label ? ` · ${qrResa.table_label}` : ""}
            </div>
            <div style={{ display: "inline-block", background: "white", padding: 12, borderRadius: 12, border: "0.5px solid #eee" }}>
              <QRCode value={qrResa.ref} size={200} fgColor={DARK} />
            </div>
            <div style={{ fontSize: 13, color: "#4a5a52", marginTop: 16, lineHeight: 1.5 }}>
              Présentez ce QR à l'entrée pour votre <strong>check-in</strong>.
            </div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 6, fontFamily: "monospace" }}>{qrResa.ref}</div>
            <button onClick={() => setQrResa(null)}
              style={{ marginTop: 18, width: "100%", padding: "11px 0", borderRadius: 11, border: "none",
                background: G, color: "#1A1000", fontSize: 14, fontWeight: 700, cursor: "pointer", touchAction: "manipulation" }}>
              Fermer
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Sous-composants ────────────────────────────────────────────────────────── */
function Field({ label, icon: Icon, value, onChange, readOnly, placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 5 }}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 10,
        border: "0.5px solid #ddd", borderRadius: 9, padding: "10px 12px",
        background: readOnly ? "#fafafa" : "white" }}>
        <Icon size={13} color="#bbb" />
        <input value={value} onChange={e => onChange?.(e.target.value)}
          readOnly={readOnly} placeholder={placeholder}
          style={{ border: "none", background: "transparent", fontSize: 13,
            outline: "none", flex: 1, color: readOnly ? "#999" : "#333" }} />
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 0", color: "#bbb", fontSize: 13, gap: 8 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
      Chargement…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub, children }) {
  const G = "#E8A045";
  return (
    <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
      padding: "36px 20px", textAlign: "center" }}>
      <Icon size={34} color="#ddd" style={{ margin: "0 auto 10px" }} />
      <div style={{ fontSize: 14, fontWeight: 500, color: "#bbb" }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: "#ccc", marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
      {children}
    </div>
  );
}
