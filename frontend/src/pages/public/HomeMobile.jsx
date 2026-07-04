/**
 * HomeMobile — Expérience mobile style OpenTable
 * Layout dédié mobile, desktop inchangé
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, Star, UtensilsCrossed, Bookmark, Bell,
  ChevronDown, ChevronRight, User, Calendar, Clock, Users, Navigation,
  Mail, Phone, X,
} from "lucide-react";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLang } from "../../context/LanguageContext.jsx";
import api from "../../services/api.js";
import Onboarding from "../../components/Onboarding.jsx";

const P     = "#E8A045";
const S     = "#3D6B55";
const DARK  = "#1E2E28";
const BG    = "#F8F5EF";
const WHITE = "#FFFFFF";
const MUTED = "#9BA89F";
const BORDER= "#E4DFD8";
const FONT  = "'Avenir Next','Avenir','Century Gothic',sans-serif";

const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") : "—";

// Créneaux cliquables sur les cartes (style OpenTable)
const CARD_SLOTS = ["19h00", "19h30", "20h00", "20h30"];
function slotIsPast(slot) {
  const [h, m] = slot.replace("h", ":").split(":").map(Number);
  const now = new Date();
  return h < now.getHours() || (h === now.getHours() && (m || 0) <= now.getMinutes());
}
function cardBadge(r) {
  if ((r.review_count || 0) >= 5 || (r.rating || 0) >= 4.8) return { label: "Populaire", bg: "#1E2E28" };
  if (!r.review_count) return { label: "Nouveau", bg: P };
  return null;
}

// Compteur animé (count-up) déclenché quand l'élément devient visible
function useCountUp(target, duration, start) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf, t0 = null;
    const tick = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.floor(p * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return n;
}

// Bande de statistiques mobile (confiance) — chiffres animés
function MobileStatsBand() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const restos = useCountUp(200, 1500, visible);
  const resa   = useCountUp(15000, 1700, visible);
  const cities = useCountUp(12, 1100, visible);
  const rating = useCountUp(48, 1300, visible);
  const items = [
    { v: `${restos}+`, l: "Restaurants" },
    { v: `${resa.toLocaleString("fr-FR")}+`, l: "Réservations" },
    { v: `${cities}`, l: "Villes" },
    { v: `${(rating / 10).toFixed(1)}/5`, l: "Note" },
  ];
  return (
    <div ref={ref} style={{ margin: "6px 16px 4px", background: DARK, borderRadius: 16,
      padding: "16px 10px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
      {items.map((s, i) => (
        <div key={i} style={{ textAlign: "center", borderLeft: i > 0 ? "0.5px solid rgba(255,255,255,.1)" : "none" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "white", fontFamily: FONT, letterSpacing: "-0.5px" }}>{s.v}</div>
          <div style={{ fontSize: 8.5, color: "rgba(255,255,255,.55)", marginTop: 3,
            textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Stars ── */
function Stars({ rating, size = 12 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i <= Math.round(rating || 0) ? P : "none"} stroke={P} strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
const LUNCH_SLOTS  = ["12h00","12h30","13h00","13h30","14h00","14h30"];
const DINNER_SLOTS = ["19h00","19h30","20h00","20h30","21h00","21h30","22h00"];
const ALL_TIMES    = [...LUNCH_SLOTS, ...DINNER_SLOTS];

const padZ = n => String(n).padStart(2, "0");

function buildDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    // Utilise les méthodes locales pour éviter le décalage UTC (bug July 3 → July 2)
    const iso = `${d.getFullYear()}-${padZ(d.getMonth()+1)}-${padZ(d.getDate())}`;
    return {
      iso,
      day: ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"][d.getDay()],
      num: d.getDate(),
      mon: MONTHS_FR[d.getMonth()],
    };
  });
}

export default function HomeMobile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [restaurants, setRestaurants] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [favorites,   setFavorites]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("tci_favorites") || "[]"); } catch { return []; }
  });
  const [notifCount, setNotifCount]   = useState(0);

  // Onglets catégorie
  const [activeTab,    setActiveTab]    = useState(0);
  const [activeCommune,setActiveCommune]= useState(""); // "" = toutes

  const COMMUNES = [
    "Cocody","Plateau","Marcory","Yopougon","Adjamé",
    "Abobo","Treichville","Koumassi","Port-Bouët","Attécoubé","Songon",
  ];

  const TABS = [
    { label: "Tous",               filter: () => true },
    { label: "Gastronomique",      filter: r => (r.cuisine_type || "").toLowerCase().includes("gastro") },
    { label: "Cuisine ivoirienne", filter: r => (r.cuisine_type || "").toLowerCase().includes("ivoi") },
    { label: "Brunch",             filter: r => (r.cuisine_type || "").toLowerCase().includes("brunch") || (r.name || "").toLowerCase().includes("brunch") },
    { label: "Terrasse",           filter: r => Array.isArray(r.options) && r.options.some(o => typeof o === "string" && o.toLowerCase().includes("terrasse")) },
    { label: "Live musique",       filter: r => Array.isArray(r.options) && r.options.some(o => typeof o === "string" && o.toLowerCase().includes("live")) },
  ];

  // Search card state
  const [selDate,  setSelDate]  = useState(buildDays()[0].iso);
  const [selTime,  setSelTime]  = useState("19h00");
  const [selGuest, setSelGuest] = useState(2);
  const [showDatePicker, setShowDatePicker]  = useState(false);
  const [showTimePicker, setShowTimePicker]  = useState(false);
  const [showGuestPicker,setShowGuestPicker] = useState(false);

  // Availability search
  const [searchActive,   setSearchActive]   = useState(false);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [availableSlugs, setAvailableSlugs] = useState(null); // null = pas de recherche, Set = slugs dispo

  const days = buildDays();
  const selDayObj = days.find(d => d.iso === selDate) || days[0];

  const listRef = useRef(null);

  useEffect(() => {
    restaurantsService.list({ limit: 50, sort: "rating" })
      .then(res => setRestaurants(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    if (user) {
      api.get("/notifications").then(r => {
        const notifs = r.data?.data?.notifications || r.data?.data || [];
        setNotifCount(notifs.filter(n => !n.is_read).length);
      }).catch(() => {});
    }
  }, [user]);

  const toggleFav = (e, r) => {
    e.stopPropagation();
    const arr = JSON.parse(localStorage.getItem("tci_favorites") || "[]");
    const exists = arr.some(f => f.slug === r.slug);
    const next = exists ? arr.filter(f => f.slug !== r.slug)
      : [...arr, { slug: r.slug, name: r.name, ville: r.ville, cuisine_type: r.cuisine_type }];
    setFavorites(next);
    localStorage.setItem("tci_favorites", JSON.stringify(next));
  };

  // Réinitialiser la recherche quand critères changent
  const resetSearch = () => { setSearchActive(false); setAvailableSlugs(null); };

  const filtered = (() => {
    let list = restaurants;

    // Filtre onglet catégorie
    if (activeTab > 0) {
      list = list.filter(TABS[activeTab].filter);
    }

    // Filtre commune
    if (activeCommune) {
      list = list.filter(r =>
        (r.quartier || "").toLowerCase().includes(activeCommune.toLowerCase()) ||
        (r.ville    || "").toLowerCase().includes(activeCommune.toLowerCase())
      );
    }

    // Filtre texte (nom + quartier + ville + type de cuisine)
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.quartier || "").toLowerCase().includes(q) ||
        (r.ville    || "").toLowerCase().includes(q) ||
        (r.cuisine_type || "").toLowerCase().includes(q)
      );
    }

    // Filtre disponibilité — uniquement après "Trouver une table"
    if (searchActive && availableSlugs) {
      list = list.filter(r => availableSlugs.has(r.slug));
    }

    return list;
  })();

  const handleSearch = async () => {
    // Fermer les pickers ouverts
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowGuestPicker(false);

    setSearchActive(true);
    setSearchLoading(true);
    listRef.current?.scrollIntoView({ behavior: "smooth" });

    try {
      // Vérification de disponibilité en parallèle pour chaque restaurant
      const checks = await Promise.allSettled(
        restaurants.map(r =>
          restaurantsService.getAvailability(r.slug, selDate, selGuest)
            .then(data => ({ slug: r.slug, ok: (data?.available_tables?.length || 0) > 0 }))
            .catch(() => ({ slug: r.slug, ok: false }))
        )
      );

      const slugSet = new Set(
        checks
          .filter(c => c.status === "fulfilled" && c.value.ok)
          .map(c => c.value.slug)
      );

      setAvailableSlugs(slugSet);
    } catch (_) {
      setAvailableSlugs(new Set()); // aucune dispo en cas d'erreur réseau
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: FONT, background: BG, minHeight: "100vh", paddingBottom: 80 }}>

      {/* Onboarding — 3 écrans, affiché une seule fois à la première ouverture */}
      <Onboarding />

      {/* ── Header sticky mobile ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: WHITE,
        borderBottom: `0.5px solid ${BORDER}`, padding: "12px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="9" fill={P} />
            <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
            <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
            <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
              stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" fill="none" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: DARK, letterSpacing: "-0.5px" }}>
            Tablière<span style={{ color: P }}>CI</span>
          </span>
        </div>

        {/* Icônes droite */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {notifCount > 0 && (
                <button onClick={() => navigate("/profil?tab=notifications")}
                  style={{ position: "relative", background: "none", border: "none", cursor: "pointer" }}>
                  <Bell size={20} color={MUTED} />
                  <span style={{ position: "absolute", top: -2, right: -2, width: 14, height: 14,
                    borderRadius: "50%", background: "#DC2626", color: "white",
                    fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid white" }}>
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                </button>
              )}
              {/* Avatar utilisateur */}
              <button onClick={() => navigate("/profil")}
                style={{ width: 36, height: 36, borderRadius: "50%",
                  border: `2px solid ${P}`, cursor: "pointer", overflow: "hidden",
                  background: P + "22", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0 }}>
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700, color: P }}>
                    {(user?.full_name || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <button onClick={() => navigate("/connexion")}
              style={{ background: P, color: "#1A1000", border: "none", borderRadius: 20,
                padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
              Connexion
            </button>
          )}
        </div>
      </div>

      {/* ── Search Card style OpenTable ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: DARK, marginBottom: 4, letterSpacing: "-0.5px" }}>
          La table parfaite,
        </h2>
        <p style={{ fontSize: 16, fontStyle: "italic", color: P, marginBottom: 16, fontWeight: 400 }}>
          à portée de main.
        </p>

        {/* Card de recherche */}
        <div style={{ background: WHITE, borderRadius: 16, border: `0.5px solid ${BORDER}`,
          boxShadow: "0 4px 20px rgba(30,46,40,.08)", overflow: "hidden" }}>

          {/* Champ texte */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 10px",
            borderBottom: `0.5px solid ${BG}` }}>
            <Search size={17} color={MUTED} style={{ flexShrink: 0 }} />
            <input placeholder="Restaurant, cuisine, quartier…"
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              style={{ border: "none", background: "transparent", fontSize: 15,
                color: DARK, outline: "none", width: "100%", fontFamily: FONT }} />
          </div>

          {/* Date / Heure / Personnes */}
          <div style={{ display: "flex" }}>
            {/* Date */}
            <button onClick={() => { setShowDatePicker(p => !p); setShowTimePicker(false); setShowGuestPicker(false); }}
              style={{ flex: 1, padding: "10px 12px", background: "none", border: "none",
                borderRight: `0.5px solid ${BG}`, cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase",
                letterSpacing: "0.8px", marginBottom: 2 }}>Date</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>
                {selDayObj.day} {selDayObj.num} {selDayObj.mon}
              </div>
            </button>

            {/* Heure */}
            <button onClick={() => { setShowTimePicker(p => !p); setShowDatePicker(false); setShowGuestPicker(false); }}
              style={{ flex: 1, padding: "10px 12px", background: "none", border: "none",
                borderRight: `0.5px solid ${BG}`, cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase",
                letterSpacing: "0.8px", marginBottom: 2 }}>Heure</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{selTime}</div>
            </button>

            {/* Personnes */}
            <button onClick={() => { setShowGuestPicker(p => !p); setShowDatePicker(false); setShowTimePicker(false); }}
              style={{ flex: 1, padding: "10px 12px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase",
                letterSpacing: "0.8px", marginBottom: 2 }}>Pers.</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{selGuest}</div>
            </button>
          </div>

          {/* Date picker dropdown */}
          <AnimatePresence>
            {showDatePicker && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                style={{ overflow: "hidden", borderTop: `0.5px solid ${BG}` }}>
                <div style={{ padding: "12px", display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
                  {days.map(d => {
                    const sel = d.iso === selDate;
                    return (
                      <button key={d.iso} onClick={() => { setSelDate(d.iso); setShowDatePicker(false); resetSearch(); }}
                        style={{ flexShrink: 0, width: 52, padding: "8px 0", borderRadius: 10,
                          border: `1.5px solid ${sel ? P : BORDER}`,
                          background: sel ? P : WHITE, cursor: "pointer", textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: sel ? WHITE : MUTED, fontWeight: 600 }}>{d.day}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: sel ? WHITE : DARK, lineHeight: 1.2 }}>{d.num}</div>
                        <div style={{ fontSize: 9, color: sel ? "rgba(255,255,255,.7)" : MUTED }}>{d.mon}</div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Time picker */}
          <AnimatePresence>
            {showTimePicker && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                style={{ overflow: "hidden", borderTop: `0.5px solid ${BG}` }}>
                <div style={{ padding: "12px" }}>
                  {[{ label: "Déjeuner", slots: LUNCH_SLOTS }, { label: "Dîner", slots: DINNER_SLOTS }].map(({ label, slots }) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "1px", marginBottom: 6 }}>{label}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {slots.map(t => {
                          const sel = t === selTime;
                          return (
                            <button key={t} onClick={() => { setSelTime(t); setShowTimePicker(false); resetSearch(); }}
                              style={{ padding: "7px 12px", borderRadius: 8,
                                border: `1px solid ${sel ? P : BORDER}`,
                                background: sel ? P : WHITE, color: sel ? WHITE : DARK,
                                fontSize: 13, fontWeight: sel ? 600 : 400, cursor: "pointer", fontFamily: FONT }}>
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Guest picker */}
          <AnimatePresence>
            {showGuestPicker && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                style={{ overflow: "hidden", borderTop: `0.5px solid ${BG}` }}>
                <div style={{ padding: "12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[1,2,3,4,5,6,7,8,9,10,12,15,20].map(n => {
                    const sel = n === selGuest;
                    return (
                      <button key={n} onClick={() => { setSelGuest(n); setShowGuestPicker(false); resetSearch(); }}
                        style={{ width: 40, height: 40, borderRadius: 8,
                          border: `1px solid ${sel ? P : BORDER}`,
                          background: sel ? P : WHITE, color: sel ? WHITE : DARK,
                          fontSize: 13, fontWeight: sel ? 700 : 400, cursor: "pointer", fontFamily: FONT }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bouton Trouver */}
          <div style={{ padding: "10px 12px 12px" }}>
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleSearch}
              disabled={searchLoading}
              style={{ width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
                background: searchLoading ? "#C47D1A" : P, color: "#1A1000", fontSize: 15, fontWeight: 800,
                cursor: searchLoading ? "not-allowed" : "pointer", fontFamily: FONT, letterSpacing: "0.3px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {searchLoading ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(30,46,40,.3)",
                    borderTopColor: DARK, borderRadius: "50%",
                    animation: "spin 0.7s linear infinite" }} />
                  Recherche en cours…
                </>
              ) : "Trouver une table"}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Géolocalisation ── */}
      <div style={{ padding: "8px 16px" }}>
        <button onClick={() => {
          if (!navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition(pos => {
            const { latitude } = pos.coords;
            const city = latitude >= 4.8 && latitude <= 6.2 ? "Abidjan" : "Abidjan";
            setSearch(city);
            // handleSearch est passé via callback pour éviter de lire le stale state
            // On scroll vers la liste sans re-déclencher la recherche de dispo
            listRef.current?.scrollIntoView({ behavior: "smooth" });
          }, () => {});
        }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "none", cursor: "pointer", fontSize: 13, color: S, fontFamily: FONT }}>
          <Navigation size={14} color={S} />
          Utiliser ma position
        </button>
      </div>

      {/* ── Onglets catégories (scrollable horizontal) ── */}
      <div style={{ background: WHITE, borderBottom: `0.5px solid ${BORDER}`,
        overflowX: "auto", display: "flex", scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch" }}>
        <style>{`.tci-tabs::-webkit-scrollbar { display: none; }`}</style>
        <div className="tci-tabs" style={{ display: "flex", padding: "0 12px", minWidth: "max-content" }}>
          {TABS.map((tab, i) => (
            <button key={i} onClick={() => { setActiveTab(i); resetSearch(); }}
              style={{ padding: "11px 14px", fontSize: 13, cursor: "pointer",
                background: "transparent", border: "none", whiteSpace: "nowrap",
                color: activeTab === i ? P : MUTED,
                borderBottom: `2.5px solid ${activeTab === i ? P : "transparent"}`,
                fontWeight: activeTab === i ? 700 : 400, fontFamily: FONT,
                transition: "all .15s", flexShrink: 0 }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtre communes ── */}
      <div style={{ overflowX: "auto", display: "flex", padding: "8px 12px",
        gap: 6, scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
        borderBottom: `0.5px solid ${BORDER}`, background: WHITE }}>
        {["Toutes", ...COMMUNES].map((c, i) => {
          const val   = i === 0 ? "" : c;
          const active = activeCommune === val;
          return (
            <button key={c} onClick={() => { setActiveCommune(val); resetSearch(); }}
              style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20,
                fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer",
                border: `0.5px solid ${active ? S : BORDER}`,
                background: active ? S : WHITE,
                color: active ? WHITE : MUTED, fontFamily: FONT,
                transition: "all .15s" }}>
              {c}
            </button>
          );
        })}
      </div>

      {/* ── Bande de confiance (stats animées) ── */}
      <MobileStatsBand />

      {/* ── Restaurant list style OpenTable ── */}
      <div ref={listRef} id="tci-restaurant-list" style={{ padding: "8px 0" }}>

        {/* Titre section */}
        <div style={{ padding: "12px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED,
              textTransform: "uppercase", letterSpacing: "1.5px" }}>
              {searchActive ? `DISPONIBLES · ${selGuest} pers.` : "RÉSULTATS — ABIDJAN"}
            </div>
            {searchActive && (
              <button onClick={resetSearch}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "#FEF2F0",
                  border: `0.5px solid #FECACA`, borderRadius: 7, padding: "4px 8px",
                  fontSize: 11, color: "#C05B3A", cursor: "pointer", fontFamily: FONT }}>
                <X size={11} /> Effacer
              </button>
            )}
          </div>
          <div style={{ fontSize: 13, color: DARK }}>
            {loading || searchLoading
              ? "Recherche en cours…"
              : searchActive && availableSlugs
                ? `${filtered.length} restaurant${filtered.length !== 1 ? "s" : ""} avec tables disponibles`
                : `${filtered.length} restaurant${filtered.length !== 1 ? "s" : ""} disponible${filtered.length !== 1 ? "s" : ""}`}
          </div>
          {searchActive && !searchLoading && availableSlugs && (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
              {selDayObj.day} {selDayObj.num} {selDayObj.mon} · {selTime} · {selGuest} personne{selGuest > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Cards restaurants */}
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ margin: "0 16px 12px", background: WHITE,
              borderRadius: 12, border: `0.5px solid ${BORDER}`, overflow: "hidden",
              animation: "skeleton-shimmer 1.4s infinite",
              background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)",
              backgroundSize: "200% 100%", height: 110 }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED }}>
            <UtensilsCrossed size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: DARK }}>Aucun restaurant trouvé</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Essayez une autre recherche</div>
          </div>
        ) : filtered.map((r, idx) => (
          <motion.div key={r.id || idx}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            onClick={() => navigate(`/restaurants/${r.slug}`)}
            style={{ margin: "0 16px 10px", background: WHITE, borderRadius: 14,
              border: `0.5px solid ${BORDER}`, overflow: "hidden",
              cursor: "pointer", display: "flex", gap: 0 }}>

            {/* Photo restaurant — première de photos[] ou logo_url */}
            {(() => {
              const photos = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos : null;
              const imgSrc = photos ? photos[0] : r.logo_url;
              return (
              <div style={{ width: 100, minHeight: 110, background: BG, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", overflow: "hidden" }}>
              {imgSrc ? (
                <img src={imgSrc} alt={r.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                  onError={e => { e.target.style.display = "none"; }} />
              ) : (
                <UtensilsCrossed size={28} color={P} style={{ opacity: 0.4 }} />
              )}
              {/* Favori */}
              <button onClick={e => toggleFav(e, r)}
                style={{ position: "absolute", top: 6, left: 6, background: "rgba(255,255,255,.85)",
                  border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                <Bookmark size={13}
                  fill={favorites.some(f => f.slug === r.slug) ? P : "none"}
                  color={favorites.some(f => f.slug === r.slug) ? P : MUTED} />
              </button>
              {/* Badge de mise en avant */}
              {(() => {
                const b = cardBadge(r);
                return b ? (
                  <span style={{ position: "absolute", bottom: 6, left: 6, fontSize: 8.5, fontWeight: 700,
                    color: "white", background: b.bg, padding: "2px 7px", borderRadius: 20,
                    letterSpacing: "0.3px", fontFamily: FONT }}>{b.label}</span>
                ) : null;
              })()}
            </div>
              );
            })()}

            {/* Infos */}
            <div style={{ flex: 1, padding: "12px 12px 10px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 3 }}>
                {r.name}
              </div>

              {/* Rating */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                {r.rating > 0 ? (
                  <>
                    <Stars rating={r.rating} />
                    <span style={{ fontSize: 11, color: MUTED }}>
                      {Number(r.rating).toFixed(1)} ({r.review_count || 0})
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: MUTED }}>Nouveau restaurant</span>
                )}
              </div>

              {/* Métadonnées */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {r.cuisine_type && (
                  <span style={{ fontSize: 11, color: MUTED }}>{r.cuisine_type}</span>
                )}
                {r.quartier && (
                  <>
                    <span style={{ fontSize: 11, color: BORDER }}>·</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{r.quartier}</span>
                  </>
                )}
                {r.price_range && (
                  <>
                    <span style={{ fontSize: 11, color: BORDER }}>·</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{r.price_range}</span>
                  </>
                )}
              </div>

              {/* Créneaux cliquables (style OpenTable) */}
              {(() => {
                const slots = CARD_SLOTS.filter(s => !slotIsPast(s));
                if (slots.length === 0) {
                  return (
                    <motion.button whileTap={{ scale: 0.96 }}
                      onClick={e => { e.stopPropagation(); navigate(`/restaurants/${r.slug}`); }}
                      style={{ background: P + "18", color: "#C47D1A", border: `0.5px solid ${P}55`,
                        borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: FONT }}>
                      Voir les créneaux →
                    </motion.button>
                  );
                }
                return (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {slots.slice(0, 3).map(s => (
                      <motion.button key={s} whileTap={{ scale: 0.93 }}
                        onClick={e => { e.stopPropagation(); navigate(`/restaurants/${r.slug}?slot=${s}&guests=2`); }}
                        style={{ background: P, color: "white", border: "none",
                          borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", fontFamily: FONT }}>
                        {s}
                      </motion.button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Footer mobile ── */}
      <footer style={{ background: DARK, marginTop: 28, padding: "28px 20px 100px", fontFamily: FONT }}>

        {/* Ligne contact + paiements */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="9" fill={P} />
              <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
              <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
              <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
                stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" fill="none" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: "white" }}>
              Tablière<span style={{ color: P }}>CI</span>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {[
              { icon: Mail,   text: "contact@tabliereci.net" },
              { icon: Phone,  text: "+225 07 00 00 00 00"    },
              { icon: MapPin, text: "Abidjan, Côte d'Ivoire" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <item.icon size={13} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{item.text}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Séparateur */}
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", paddingTop: 16,
          display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Confidentialité", href: "/confidentialite" },
              { label: "CGU",             href: "/cgu" },
              { label: "Mentions légales",href: "/mentions-legales" },
            ].map(({ label, href }, i) => (
              <a key={i} href={href}
                style={{ fontSize: 11, color: "rgba(255,255,255,0.35)",
                  textDecoration: "none" }}>
                {label}
              </a>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
            © 2026 TablièreCI. Tous droits réservés.
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
