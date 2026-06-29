import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, User, CalendarCheck, Star, Heart,
  Camera, Mail, Phone, ArrowLeft, MessageCircle, Bell,
  Globe, CheckCircle, Award, LogOut, X, Share2,
  Clock, ChevronRight, Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../services/api.js";
import { useLang } from "../../context/LanguageContext.jsx";
import { reservationsService } from "../../services/reservations.service.js";
import { notificationsService, chatService } from "../../services/chat.service.js";
import Chat from "../../components/Chat.jsx";

const G = "#1D9E75";
const DARK = "#0F6E56";

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
  const { user, logout } = useAuth();
  const { lang, t, changeLang, langs } = useLang();

  // Onglet initial depuis ?tab=xxx
  const urlTab = new URLSearchParams(location.search).get("tab") || "profile";
  const [tab, setTab] = useState(urlTab);

  const [photo,        setPhoto]        = useState(() => localStorage.getItem("tci_avatar") || null);
  const [form,         setForm]         = useState({ nom: user?.full_name || "", phone: user?.phone || "" });
  const [saved,        setSaved]        = useState(true);
  const [showLang,     setShowLang]     = useState(false);
  const [reservations, setReservations] = useState([]);
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

  // Charger réservations
  useEffect(() => {
    reservationsService.myReservations({ limit: 50 })
      .then(res => {
        const list = res.data || [];
        setReservations(list);
        setPoints(list.filter(r => ["confirme","confirmé"].includes(r.status)).length * 50);
      })
      .catch(() => {})
      .finally(() => setLoadingR(false));
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
        localStorage.setItem("tci_avatar", b64);
        setSaved(false); // ← active le bouton Sauvegarder
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeFavorite = (slug) => {
    const updated = favorites.filter(f => f.slug !== slug);
    setFavorites(updated);
    localStorage.setItem("tci_favorites", JSON.stringify(updated));
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
        padding: "14px 20px", background: "white", borderBottom: "0.5px solid #eee",
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
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 40px" }}>

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
                    if (photo) localStorage.setItem("tci_avatar", photo);
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
          </motion.div>
        )}

        {/* ── RÉSERVATIONS ───────────────────────────────────────────────── */}
        {tab === "reservations" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
                {reservations.map((r, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 14,
                    border: "0.5px solid #eee", padding: "13px 14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#E1F5EE",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <UtensilsCrossed size={18} color={G} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {r.restaurant_name || r.resto_name || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>
                          {fmtDate(r.reserved_at)} · {r.party_size} pers.
                        </div>
                        {r.ref && (
                          <div style={{ fontSize: 11, color: "#bbb", marginTop: 2, fontFamily: "monospace" }}>
                            Réf. {r.ref}
                          </div>
                        )}
                      </div>
                      <div style={{ background: STATUS_BG[r.status] || "#f5f5f5",
                        color: STATUS_COLOR[r.status] || "#666",
                        borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                        {STATUS_LABEL[r.status] || r.status}
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
                  {i === 1 && "Priorité de réservation · -5% sur les arrhes"}
                  {i === 2 && "Accès aux offres exclusives · -10% sur les arrhes · Support prioritaire"}
                  {i === 3 && "Accès VIP · Réservations sans arrhes · Concierge dédié"}
                </div>
              </div>
            ))}

            <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "10px 12px",
              fontSize: 12, color: "#999", textAlign: "center" }}>
              🎯 Vous gagnez <strong>50 points</strong> par réservation confirmée
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
  const G = "#1D9E75";
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
