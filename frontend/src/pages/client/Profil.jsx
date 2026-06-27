import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, User, CalendarCheck, Star, Heart,
  Camera, Mail, Phone, ArrowLeft, MessageCircle, ChevronRight,
  Globe, CheckCircle, Bookmark, Award, LogOut, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLang } from "../../context/LanguageContext.jsx";
import { reservationsService } from "../../services/reservations.service.js";

const G = "#1D9E75";
const DARK = "#0F6E56";

const LANG_LABELS = { fr: "Français", en: "English", ar: "العربية" };
const LANG_FLAGS  = { fr: "🇫🇷", en: "🇬🇧", ar: "🇸🇦" };

const LEVELS = [
  { name: "Bronze",   min: 0,    color: "#CD7F32", bg: "#FDF0E6" },
  { name: "Argent",   min: 500,  color: "#9E9E9E", bg: "#F5F5F5" },
  { name: "Or",       min: 1500, color: "#EF9F27", bg: "#FFFBEC" },
  { name: "Platinum", min: 4000, color: "#185FA5", bg: "#E6F1FB" },
];

const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
  : "—";

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

export default function Profil() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lang, t, changeLang, langs } = useLang();

  const [tab,         setTab]         = useState("profile");
  const [photo,       setPhoto]       = useState(() => localStorage.getItem("tci_avatar") || null);
  const [form,        setForm]        = useState({ nom: user?.full_name || "", phone: user?.phone || "" });
  const [saved,       setSaved]       = useState(true);
  const [showLang,    setShowLang]    = useState(false);
  const [reservations,setReservations]= useState([]);
  const [loadingR,    setLoadingR]    = useState(true);
  const [favorites,   setFavorites]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("tci_favorites") || "[]"); } catch { return []; }
  });
  const fileRef = useRef(null);

  // Points fictifs basés sur le nb de réservations (à remplacer par API plus tard)
  const [points, setPoints] = useState(0);

  useEffect(() => {
    reservationsService.myReservations({ limit: 50 })
      .then(res => {
        const list = res.data || [];
        setReservations(list);
        // 50 pts par résa confirmée
        const confirmed = list.filter(r => ["confirme","confirmé"].includes(r.status));
        setPoints(confirmed.length * 50);
      })
      .catch(() => setReservations([]))
      .finally(() => setLoadingR(false));
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
      const b64 = ev.target.result;
      setPhoto(b64);
      localStorage.setItem("tci_avatar", b64);
    };
    reader.readAsDataURL(file);
  };

  const removeFavorite = (slug) => {
    const updated = favorites.filter(f => f.slug !== slug);
    setFavorites(updated);
    localStorage.setItem("tci_favorites", JSON.stringify(updated));
  };

  const TABS = [
    { id: "profile",      label: t("tab_profile"),      icon: User },
    { id: "reservations", label: t("tab_reservations"), icon: CalendarCheck },
    { id: "rewards",      label: t("tab_rewards"),      icon: Award },
    { id: "saved",        label: t("tab_saved"),        icon: Heart },
  ];

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#f7f7f5", minHeight: "100vh",
      direction: lang === "ar" ? "rtl" : "ltr" }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px", background: "white", borderBottom: "0.5px solid #eee",
        position: "sticky", top: 0, zIndex: 30 }}>
        <button onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", cursor: "pointer", color: "#888", fontSize: 13 }}>
          <ArrowLeft size={15} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: G,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UtensilsCrossed size={13} color="white" />
            </div>
            <span style={{ fontWeight: 600, color: G, fontSize: 16 }}>TablièreCI</span>
          </div>
        </button>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Sélecteur langue */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowLang(p => !p)}
              style={{ display: "flex", alignItems: "center", gap: 6, border: "0.5px solid #ddd",
                borderRadius: 8, padding: "6px 12px", background: "white",
                cursor: "pointer", fontSize: 12, color: "#555" }}>
              <Globe size={13} color={G} />
              {LANG_FLAGS[lang]} {LANG_LABELS[lang]}
            </button>
            <AnimatePresence>
              {showLang && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "white",
                    border: "0.5px solid #eee", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,.1)",
                    overflow: "hidden", minWidth: 140, zIndex: 100 }}>
                  {langs.map(l => (
                    <button key={l} onClick={() => { changeLang(l); setShowLang(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "9px 14px", border: "none", background: l === lang ? "#E1F5EE" : "white",
                        cursor: "pointer", fontSize: 13, color: l === lang ? G : "#444",
                        fontWeight: l === lang ? 500 : 400 }}>
                      {LANG_FLAGS[l]} {LANG_LABELS[l]}
                      {l === lang && <CheckCircle size={13} color={G} style={{ marginLeft: "auto" }} />}
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
      <div style={{ background: DARK, padding: "28px 28px 52px", textAlign: "center" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#9FE1CB",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", border: "3px solid white" }}>
            {photo
              ? <img src={photo} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <User size={36} color="white" />
            }
          </div>
          <button onClick={() => fileRef.current?.click()}
            style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24,
              borderRadius: "50%", background: G, border: "2px solid white",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer" }}>
            <Camera size={11} color="white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto}
            style={{ display: "none" }} />
        </div>
        <div style={{ color: "white", fontWeight: 600, fontSize: 18, marginTop: 10 }}>
          {user?.full_name || "—"}
        </div>
        <div style={{ color: "#9FE1CB", fontSize: 13, marginTop: 2 }}>{user?.email}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
          background: currentLevel.bg, borderRadius: 20, padding: "4px 12px" }}>
          <Award size={13} color={currentLevel.color} />
          <span style={{ fontSize: 12, fontWeight: 500, color: currentLevel.color }}>
            {currentLevel.name} — {points} pts
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "white", borderBottom: "0.5px solid #eee",
        padding: "0 20px", overflowX: "auto", gap: 2, marginTop: -28 + "px" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "14px 16px",
              border: "none", background: "transparent", cursor: "pointer", whiteSpace: "nowrap",
              fontSize: 13, fontWeight: tab === id ? 600 : 400,
              color: tab === id ? G : "#888",
              borderBottom: tab === id ? `2px solid ${G}` : "2px solid transparent" }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 40px" }}>

        {/* ── PROFIL ─────────────────────────────────────────────────────── */}
        {tab === "profile" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
              padding: "20px 22px", marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 18, color: "#1a1a1a" }}>
                {t("profile_title")}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label={t("profile_name")} icon={User}
                  value={form.nom} onChange={v => { setForm(p => ({ ...p, nom: v })); setSaved(false); }}
                  placeholder="Fatou Amara" />
                <Field label={t("profile_email")} icon={Mail}
                  value={user?.email || ""} readOnly placeholder="" />
                <Field label={t("profile_phone")} icon={Phone}
                  value={form.phone} onChange={v => { setForm(p => ({ ...p, phone: v })); setSaved(false); }}
                  placeholder="+225 07 00 00 00 00" />
              </div>

              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => setSaved(true)}
                style={{ marginTop: 18, background: G, color: "white", border: "none",
                  borderRadius: 9, padding: "11px 0", width: "100%", fontSize: 14,
                  fontWeight: 600, cursor: "pointer", opacity: saved ? 0.5 : 1,
                  transition: "opacity 0.2s" }}
                disabled={saved}>
                {saved ? "✓ Enregistré" : t("profile_save")}
              </motion.button>
            </div>

            {/* Contact */}
            <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
              padding: "18px 22px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {t("profile_contact")}
              </div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 14, lineHeight: 1.5 }}>
                {t("profile_contact_desc")}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a href="https://wa.me/2250700000000"
                  target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#E1F5EE",
                    color: G, borderRadius: 9, padding: "9px 16px", fontSize: 13,
                    fontWeight: 500, textDecoration: "none" }}>
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <a href="mailto:support@tabliereci.com"
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f5f5",
                    color: "#555", borderRadius: 9, padding: "9px 16px", fontSize: 13,
                    fontWeight: 500, textDecoration: "none" }}>
                  <Mail size={14} /> Email
                </a>
              </div>
            </div>

            {/* Sélecteur de langue */}
            <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
              padding: "18px 22px", marginTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                <Globe size={15} style={{ verticalAlign: "middle", marginRight: 6, color: G }} />
                {t("lang_label")}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {langs.map(l => (
                  <button key={l} onClick={() => changeLang(l)}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 9, cursor: "pointer",
                      border: `1.5px solid ${l === lang ? G : "#eee"}`,
                      background: l === lang ? "#E1F5EE" : "white",
                      color: l === lang ? G : "#555", fontWeight: l === lang ? 600 : 400, fontSize: 13 }}>
                    {LANG_FLAGS[l]} {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── RÉSERVATIONS ───────────────────────────────────────────────── */}
        {tab === "reservations" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#1a1a1a" }}>
              {t("reserv_title")}
            </div>
            {loadingR ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#bbb" }}>{t("loading")}</div>
            ) : reservations.length === 0 ? (
              <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
                padding: "40px 20px", textAlign: "center" }}>
                <CalendarCheck size={36} color="#ddd" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: 15, fontWeight: 500, color: "#bbb" }}>{t("reserv_empty")}</div>
                <div style={{ fontSize: 13, color: "#ccc", marginTop: 6 }}>{t("reserv_empty_sub")}</div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/")}
                  style={{ marginTop: 20, background: G, color: "white", border: "none",
                    borderRadius: 9, padding: "10px 22px", fontSize: 13,
                    fontWeight: 500, cursor: "pointer" }}>
                  Voir les restaurants
                </motion.button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reservations.map((r, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 14,
                    border: "0.5px solid #eee", padding: "14px 16px",
                    display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f5f5f5",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <UtensilsCrossed size={20} color="#bbb" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                        {r.restaurant_name || r.resto_name || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>
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
                      borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                      {STATUS_LABEL[r.status] || r.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── REWARDS ────────────────────────────────────────────────────── */}
        {tab === "rewards" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {/* Carte niveau */}
            <div style={{ background: currentLevel.bg, borderRadius: 14,
              border: `1px solid ${currentLevel.color}33`, padding: "22px 22px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Award size={28} color={currentLevel.color} />
                <div>
                  <div style={{ fontSize: 12, color: "#888" }}>{t("rewards_level")}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: currentLevel.color }}>
                    {currentLevel.name}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: currentLevel.color }}>{points}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t("rewards_points")}</div>
                </div>
              </div>
              {nextLevel && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    fontSize: 11, color: "#888", marginBottom: 5 }}>
                    <span>{currentLevel.name}</span>
                    <span>{t("rewards_next")} : {nextLevel.name} ({nextLevel.min} pts)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: "#ddd", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4,
                      background: currentLevel.color, width: `${progress}%`, transition: "width 0.8s" }} />
                  </div>
                </>
              )}
            </div>

            {/* Avantages par niveau */}
            {LEVELS.map((lvl, i) => (
              <div key={i} style={{ background: "white", borderRadius: 12,
                border: `0.5px solid ${lvl.name === currentLevel.name ? lvl.color + "66" : "#eee"}`,
                padding: "14px 16px", marginBottom: 10,
                opacity: points >= lvl.min ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Award size={15} color={lvl.color} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: lvl.color }}>{lvl.name}</span>
                  <span style={{ fontSize: 11, color: "#aaa", marginLeft: "auto" }}>
                    dès {lvl.min} pts
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                  {i === 0 && "Accès à la plateforme · Réservations en ligne"}
                  {i === 1 && "Priorité de réservation · -5% sur les arrhes"}
                  {i === 2 && "Accès aux offres exclusives · -10% sur les arrhes · Support prioritaire"}
                  {i === 3 && "Accès VIP · Réservations sans arrhes · Concierge dédié"}
                </div>
              </div>
            ))}

            <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "12px 14px",
              fontSize: 12, color: "#999", textAlign: "center", marginTop: 8 }}>
              🎯 Vous gagnez <strong>50 points</strong> par réservation confirmée
            </div>
          </motion.div>
        )}

        {/* ── RESTAURANTS SAUVEGARDÉS ─────────────────────────────────────── */}
        {tab === "saved" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#1a1a1a" }}>
              {t("saved_title")}
            </div>
            {favorites.length === 0 ? (
              <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #eee",
                padding: "40px 20px", textAlign: "center" }}>
                <Heart size={36} color="#ddd" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: 15, fontWeight: 500, color: "#bbb" }}>{t("saved_empty")}</div>
                <div style={{ fontSize: 13, color: "#ccc", marginTop: 6 }}>{t("saved_empty_sub")}</div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/")}
                  style={{ marginTop: 20, background: G, color: "white", border: "none",
                    borderRadius: 9, padding: "10px 22px", fontSize: 13,
                    fontWeight: 500, cursor: "pointer" }}>
                  Voir les restaurants
                </motion.button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {favorites.map((fav, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 14,
                    border: "0.5px solid #eee", padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10,
                      background: fav.cover_color || "#E1F5EE",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {fav.cover_url
                        ? <img src={fav.cover_url} alt={fav.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                        : <UtensilsCrossed size={20} color={G} />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{fav.name}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{fav.ville} · {fav.cuisine_type}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => navigate(`/restaurants/${fav.slug}`)}
                        style={{ border: "0.5px solid #eee", borderRadius: 8, padding: "6px 12px",
                          background: "transparent", cursor: "pointer", fontSize: 12, color: G }}>
                        Voir
                      </button>
                      <button onClick={() => removeFavorite(fav.slug)}
                        style={{ border: "none", background: "transparent",
                          cursor: "pointer", color: "#ccc", padding: 4 }}>
                        <X size={14} />
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

function Field({ label, icon: Icon, value, onChange, readOnly, placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#555",
        display: "block", marginBottom: 5 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10,
        border: "0.5px solid #ddd", borderRadius: 9, padding: "10px 13px",
        background: readOnly ? "#fafafa" : "white" }}>
        <Icon size={14} color="#bbb" />
        <input value={value} onChange={e => onChange?.(e.target.value)}
          readOnly={readOnly} placeholder={placeholder}
          style={{ border: "none", background: "transparent", fontSize: 13,
            outline: "none", flex: 1, color: readOnly ? "#999" : "#333" }} />
      </div>
    </div>
  );
}
