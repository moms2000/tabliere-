import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Star, MapPin, Music, Sunrise, Gift, UtensilsCrossed,
  Heart, User, LogOut, Globe, CheckCircle, ChevronDown, BookOpen, Sparkles,
  Calendar, Clock, Users, ChevronLeft, ChevronRight, Plus, Minus,
} from "lucide-react";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLang } from "../../context/LanguageContext.jsx";

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const P      = "#E8A045";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const WHITE  = "#FFFFFF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";
const CARD_ACCENT = [P, S, DARK, "#B07A3A", "#5A8A6A", "#2E4A3A"];

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR   = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const LANG_LABELS = { fr: "Français", en: "English", ar: "العربية" };
const LANG_FLAGS  = { fr: "🇫🇷", en: "🇬🇧", ar: "🇸🇦" };

/* ── Logo SVG ────────────────────────────────────────────────────────────────── */
function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={P} />
      <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
      <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
      <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
        stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

/* ── Décor hero SVG ──────────────────────────────────────────────────────────── */
function HeroDecor() {
  return (
    <svg viewBox="0 0 460 340" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}>
      {/* Fond sable doux */}
      <rect width="460" height="340" fill="#F0EBE1" rx="16" />

      {/* Grande assiette principale */}
      <circle cx="230" cy="170" r="110" fill="white" stroke={BORDER} strokeWidth="1" />
      <circle cx="230" cy="170" r="88"  fill={BG}   stroke={BORDER} strokeWidth="0.5" />
      <circle cx="230" cy="170" r="58"  fill="white" stroke={BORDER} strokeWidth="0.5" />

      {/* Fourchette gauche */}
      <rect x="113" y="100" width="3" height="80" rx="1.5" fill={MUTED} opacity="0.5" />
      <rect x="108" y="100" width="2" height="40" rx="1"   fill={MUTED} opacity="0.4" />
      <rect x="118" y="100" width="2" height="40" rx="1"   fill={MUTED} opacity="0.4" />
      <rect x="113" y="140" width="8"  height="2"  rx="1"   fill={MUTED} opacity="0.4" />

      {/* Couteau droit */}
      <rect x="344" y="100" width="3" height="80" rx="1.5" fill={MUTED} opacity="0.5" />
      <path d="M347 100 C352 108 352 118 347 122 L347 100Z" fill={MUTED} opacity="0.35" />

      {/* Cuillère haut-droite */}
      <circle cx="334" cy="88" r="10" fill="none" stroke={P} strokeWidth="1.5" opacity="0.5" />
      <rect x="333" y="97" width="2.5" height="28" rx="1.25" fill={P} opacity="0.45" />

      {/* Herbe déco sur assiette */}
      <ellipse cx="210" cy="165" rx="14" ry="8" fill={S} opacity="0.25" />
      <ellipse cx="248" cy="168" rx="10" ry="6" fill={P} opacity="0.3" />
      <ellipse cx="226" cy="178" rx="8"  ry="5" fill={DARK} opacity="0.12" />

      {/* Verre vin gauche */}
      <path d="M75 80 L85 80 L84 112 L82 116 L82 140 L78 140 L78 116 L76 112Z"
        fill="none" stroke={S} strokeWidth="1.5" opacity="0.5" />
      <path d="M76 92 Q80 104 84 92" fill={S} opacity="0.15" stroke="none" />

      {/* Verre eau droite */}
      <rect x="368" y="130" width="20" height="36" rx="4" fill="none" stroke={P} strokeWidth="1.5" opacity="0.45" />
      <path d="M368 142 L388 142" stroke={P} strokeWidth="0.5" opacity="0.3" />
      <ellipse cx="378" cy="138" rx="5" ry="2" fill={P} opacity="0.1" />

      {/* Motif wax coin haut gauche */}
      <g opacity="0.12">
        <circle cx="40"  cy="40"  r="18" fill={P} />
        <circle cx="70"  cy="30"  r="10" fill={S} />
        <circle cx="30"  cy="70"  r="10" fill={S} />
        <circle cx="60"  cy="60"  r="6"  fill={DARK} />
      </g>

      {/* Motif wax coin bas droite */}
      <g opacity="0.1">
        <circle cx="420" cy="300" r="22" fill={S} />
        <circle cx="445" cy="280" r="12" fill={P} />
        <circle cx="400" cy="320" r="12" fill={P} />
        <circle cx="425" cy="310" r="7"  fill={DARK} />
      </g>

      {/* Petits points décoratifs */}
      {[40,80,120,160,200,240,280,320,360,400].map((x, i) =>
        i % 2 === 0
          ? <circle key={x} cx={x} cy={330} r="2" fill={P} opacity="0.2" />
          : <circle key={x} cx={x} cy={330} r="2" fill={S} opacity="0.2" />
      )}

      {/* Badge disponibilité */}
      <rect x="148" y="50" width="164" height="32" rx="16" fill={DARK} />
      <circle cx="168" cy="66" r="5" fill={S} />
      <rect x="178" y="62" width="80" height="3"  rx="1.5" fill="white" opacity="0.7" />
      <rect x="178" y="69" width="50" height="2.5" rx="1.25" fill="white" opacity="0.35" />
      <rect x="268" y="60" width="30" height="12" rx="6" fill={P} />
      <rect x="274" y="64" width="18" height="2" rx="1" fill={DARK} />
      <rect x="276" y="68" width="14" height="2" rx="1" fill={DARK} />

      {/* Badge note */}
      <rect x="310" y="190" width="100" height="44" rx="10" fill="white" stroke={BORDER} strokeWidth="0.5" />
      <rect x="320" y="200" width="12" height="12" rx="6" fill="#FEF6EC" />
      <path d="M326 200 L327.5 204 L332 204 L328.5 207 L330 211 L326 208.5 L322 211 L323.5 207 L320 204 L324.5 204Z"
        fill={P} />
      <rect x="337" y="202" width="30" height="2.5" rx="1.25" fill={DARK} opacity="0.7" />
      <rect x="337" y="208" width="20" height="2" rx="1"    fill={MUTED} opacity="0.5" />
      <rect x="320" y="218" width="80" height="2" rx="1" fill={BG} />
      <rect x="320" y="224" width="55" height="2" rx="1" fill={BG} />

      {/* Badge réservation */}
      <rect x="50" y="200" width="110" height="44" rx="10" fill="white" stroke={BORDER} strokeWidth="0.5" />
      <rect x="60" y="210" width="14" height="14" rx="7" fill="#FEF6EC" />
      <path d="M67 213 L67 220 M64 216 L70 216" stroke={P} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="80" y="212" width="45" height="2.5" rx="1.25" fill={DARK} opacity="0.7" />
      <rect x="80" y="218" width="35" height="2"   rx="1"    fill={MUTED} opacity="0.5" />
      <rect x="60" y="228" width="90" height="2" rx="1" fill={S} opacity="0.5" />
      <rect x="60" y="234" width="60" height="2" rx="1" fill={BG} />
    </svg>
  );
}

/* ── Calendrier custom ───────────────────────────────────────────────────────── */
function CalendarDropdown({ value, onChange, onClose }) {
  const today   = new Date();
  const sel     = value ? new Date(value + "T00:00:00") : null;
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isPast  = (d) => !d || new Date(year, month, d) < todayStart;
  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
  const isSel   = (d) => sel && d && year === sel.getFullYear() && month === sel.getMonth() && d === sel.getDate();

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  const pick = (d) => {
    if (isPast(d)) return;
    const str = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    onChange(str);
    onClose();
  };

  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
      background: WHITE, border: `0.5px solid ${BORDER}`, borderRadius: 14,
      boxShadow: "0 8px 32px rgba(30,46,40,.13)", padding: 16, width: 300, fontFamily: FONT }}>

      {/* Header mois */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={prev} style={iconBtn}><ChevronLeft size={16} /></button>
        <span style={{ fontSize: 14, fontWeight: 600, color: DARK }}>
          {MONTHS_FR[month]} {year}
        </span>
        <button onClick={next} style={iconBtn}><ChevronRight size={16} /></button>
      </div>

      {/* Jours */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 6 }}>
        {DAYS_FR.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600,
            color: MUTED, letterSpacing: "0.5px", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Cellules */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((d, i) => (
          <button key={i} onClick={() => pick(d)} disabled={!d || isPast(d)}
            style={{ height: 34, borderRadius: 7, border: "none", cursor: d && !isPast(d) ? "pointer" : "default",
              fontSize: 13, fontFamily: FONT,
              background: isSel(d) ? P : isToday(d) ? "#FEF6EC" : "transparent",
              color: isSel(d) ? "#1A1000" : isPast(d) ? BORDER : DARK,
              fontWeight: isSel(d) || isToday(d) ? 600 : 400,
              outline: isToday(d) && !isSel(d) ? `1.5px solid ${P}` : "none",
              opacity: !d ? 0 : 1,
              transition: "background .12s" }}>
            {d || ""}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Dropdown temps ──────────────────────────────────────────────────────────── */
const TIME_SLOTS = [
  "11:30","12:00","12:30","13:00","13:30","14:00",
  "18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00",
];

function TimeDropdown({ value, onChange, onClose }) {
  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
      background: WHITE, border: `0.5px solid ${BORDER}`, borderRadius: 14,
      boxShadow: "0 8px 32px rgba(30,46,40,.13)", overflow: "hidden",
      width: 160, maxHeight: 280, overflowY: "auto", fontFamily: FONT }}>
      {TIME_SLOTS.map(h => (
        <button key={h} onClick={() => { onChange(h); onClose(); }}
          style={{ display: "block", width: "100%", padding: "10px 18px", border: "none",
            background: value === h ? "#FEF6EC" : "transparent",
            color: value === h ? "#C47D1A" : DARK, fontWeight: value === h ? 600 : 400,
            fontSize: 13, textAlign: "left", cursor: "pointer", fontFamily: FONT,
            borderLeft: value === h ? `3px solid ${P}` : "3px solid transparent" }}>
          {h}
        </button>
      ))}
    </div>
  );
}

/* ── Dropdown guests ─────────────────────────────────────────────────────────── */
function GuestsDropdown({ value, onChange, onClose }) {
  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
      background: WHITE, border: `0.5px solid ${BORDER}`, borderRadius: 14,
      boxShadow: "0 8px 32px rgba(30,46,40,.13)", padding: 20, fontFamily: FONT, width: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED,
        letterSpacing: "1px", textTransform: "uppercase", marginBottom: 16 }}>
        Nombre de personnes
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => value > 1 && onChange(value - 1)}
          style={{ width: 36, height: 36, borderRadius: "50%", border: `0.5px solid ${BORDER}`,
            background: value > 1 ? WHITE : BG, cursor: value > 1 ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", color: DARK }}>
          <Minus size={14} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 300, color: DARK, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {value === 1 ? "personne" : "personnes"}
          </div>
        </div>
        <button onClick={() => value < 20 && onChange(value + 1)}
          style={{ width: 36, height: 36, borderRadius: "50%", border: `0.5px solid ${BORDER}`,
            background: value < 20 ? WHITE : BG, cursor: value < 20 ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", color: DARK }}>
          <Plus size={14} />
        </button>
      </div>
      <button onClick={onClose}
        style={{ marginTop: 16, width: "100%", background: P, color: "#1A1000", border: "none",
          borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: FONT }}>
        Confirmer
      </button>
    </div>
  );
}

/* ── Stars ───────────────────────────────────────────────────────────────────── */
function Stars({ rating }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11}
          fill={i <= Math.round(rating || 0) ? P : "none"}
          color={i <= Math.round(rating || 0) ? P : BORDER} />
      ))}
    </div>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const { lang, t, changeLang, langs } = useLang();
  const listRef        = useRef(null);
  const experiencesRef = useRef(null);
  const howRef         = useRef(null);

  const [restaurants, setRestaurants] = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [activeTab,   setActiveTab]   = useState(0);
  const [sort,        setSort]        = useState("rating");
  const [checkedC,    setCheckedC]    = useState({});
  const [favorites,   setFavorites]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("tci_favorites") || "[]"); } catch { return []; }
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLang,     setShowLang]     = useState(false);

  // Filtres barre
  const todayStr = new Date().toISOString().split("T")[0];
  const [resaDate,   setResaDate]   = useState(todayStr);
  const [resaTime,   setResaTime]   = useState("19:00");
  const [resaGuests, setResaGuests] = useState(2);
  const [openFilter, setOpenFilter] = useState(null); // "date" | "time" | "guests" | null

  const toggleFilter = (name) => setOpenFilter(f => f === name ? null : name);

  const TABS = [
    { key: "tab_all",       params: {} },
    { key: "tab_gastro",    params: { cuisine_type: "Gastronomique" } },
    { key: "tab_ivoirian",  params: { cuisine_type: "Ivoirienne" } },
    { key: "tab_brunch",    params: { search: "brunch" } },
    { key: "tab_terrace",   params: { search: "terrasse" } },
    { key: "tab_livemusic", params: { search: "jazz" } },
  ];

  const CUISINES = [
    { key: "cuisine_ivoirian",      val: "Ivoirienne" },
    { key: "cuisine_french",        val: "Française" },
    { key: "cuisine_lebanese",      val: "Libanaise" },
    { key: "cuisine_senegalese",    val: "Sénégalaise" },
    { key: "cuisine_international", val: "Internationale" },
  ];
  const SPECS = [
    { key: "spec_terrace",      val: "Terrasse" },
    { key: "spec_livemusic",    val: "Live music" },
    { key: "spec_halal",        val: "Halal" },
    { key: "spec_privatizable", val: "Privatisable" },
    { key: "spec_wifi",         val: "Wifi" },
  ];

  const EXPERIENCES = [
    { icon: Music,           bg: "#FEF6EC", nameKey: "exp_jazz_name",   subKey: "exp_jazz_sub"   },
    { icon: Sunrise,         bg: "#F0F6F2", nameKey: "exp_brunch_name", subKey: "exp_brunch_sub" },
    { icon: Gift,            bg: "#F0F4EC", nameKey: "exp_event_name",  subKey: "exp_event_sub"  },
    { icon: UtensilsCrossed, bg: "#FEF6EC", nameKey: "exp_feast_name",  subKey: "exp_feast_sub"  },
  ];

  const HOW_STEPS = [
    { icon: Search,   titleKey: "how_1_title", descKey: "how_1_desc", num: "01" },
    { icon: BookOpen, titleKey: "how_2_title", descKey: "how_2_desc", num: "02" },
    { icon: Sparkles, titleKey: "how_3_title", descKey: "how_3_desc", num: "03" },
  ];

  // Fermer menus + dropdowns au clic dehors
  useEffect(() => {
    const close = () => { setShowUserMenu(false); setShowLang(false); setOpenFilter(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const params = { ...TABS[activeTab].params };
    if (search) params.search = search;
    if (sort !== "rating") params.sort = sort;
    const ck = Object.entries(checkedC).filter(([,v]) => v).map(([k]) => k);
    if (ck.length === 1) params.cuisine_type = ck[0];
    setLoading(true);
    restaurantsService.list(params)
      .then(res => { setRestaurants(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(() => setRestaurants([]))
      .finally(() => setLoading(false));
  }, [search, sort, checkedC, activeTab]);

  const toggle = (setter, key) => setter(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleFavorite = (e, r) => {
    e.stopPropagation();
    const stored = JSON.parse(localStorage.getItem("tci_favorites") || "[]");
    const exists = stored.some(f => f.slug === r.slug);
    const updated = exists
      ? stored.filter(f => f.slug !== r.slug)
      : [...stored, { slug: r.slug, name: r.name, ville: r.ville, cuisine_type: r.cuisine_type }];
    setFavorites(updated);
    localStorage.setItem("tci_favorites", JSON.stringify(updated));
  };

  const isFav   = (slug) => favorites.some(f => f.slug === slug);
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const resultsText = loading
    ? t("loading")
    : total === 0
      ? t("results_count_0")
      : t("results_count").replace("{n}", total).replace(/{s}/g, total !== 1 ? "s" : "");

  const isRTL = lang === "ar";

  // Format date affichage
  const displayDate = resaDate
    ? (() => {
        const d = new Date(resaDate + "T00:00:00");
        return `${d.getDate()} ${MONTHS_FR[d.getMonth()].slice(0,3)}.`;
      })()
    : "Date";

  return (
    <div style={{ fontFamily: FONT, background: BG, minHeight: "100vh",
      direction: isRTL ? "rtl" : "ltr" }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 32px", background: WHITE, borderBottom: `0.5px solid ${BORDER}`,
        position: "sticky", top: 0, zIndex: 30, gap: 16 }}>

        <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flexShrink: 0 }}>
          <Logo size={28} />
          <span style={{ fontSize: 16, fontWeight: 600, color: DARK, letterSpacing: "-0.3px" }}>
            Tablière<span style={{ color: P }}>CI</span>
          </span>
        </div>

        <div style={{ display: "flex", gap: 28, fontSize: 13, color: MUTED }}>
          {[
            { key: "nav_restaurants", action: () => scrollTo(listRef) },
            { key: "nav_experiences", action: () => scrollTo(experiencesRef) },
            { key: "nav_how",         action: () => scrollTo(howRef) },
          ].map(({ key, action }) => (
            <span key={key} onClick={action}
              style={{ cursor: "pointer", whiteSpace: "nowrap",
                transition: "color .15s", fontWeight: 500 }}
              onMouseEnter={e => e.target.style.color = DARK}
              onMouseLeave={e => e.target.style.color = MUTED}>
              {t(key)}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Langue */}
          <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
            <button onClick={() => { setShowLang(p => !p); setShowUserMenu(false); }}
              style={{ display: "flex", alignItems: "center", gap: 5,
                border: `0.5px solid ${BORDER}`, borderRadius: 8,
                padding: "6px 10px", background: WHITE, cursor: "pointer",
                fontSize: 12, color: MUTED, fontFamily: FONT }}>
              <Globe size={13} color={P} />
              {LANG_FLAGS[lang]}
            </button>
            <AnimatePresence>
              {showLang && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{ position: "absolute", top: "calc(100% + 6px)",
                    [isRTL ? "left" : "right"]: 0, background: WHITE,
                    border: `0.5px solid ${BORDER}`, borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,.08)",
                    overflow: "hidden", minWidth: 140, zIndex: 100 }}>
                  {langs.map(l => (
                    <button key={l} onClick={() => { changeLang(l); setShowLang(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "9px 14px", border: "none",
                        background: l === lang ? "#FEF6EC" : WHITE,
                        cursor: "pointer", fontSize: 13, fontFamily: FONT,
                        color: l === lang ? P : "#444", fontWeight: l === lang ? 600 : 400 }}>
                      {LANG_FLAGS[l]} {LANG_LABELS[l]}
                      {l === lang && <CheckCircle size={12} color={P} style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {user ? (
            <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => { setShowUserMenu(p => !p); setShowLang(false); }}
                style={{ display: "flex", alignItems: "center", gap: 6,
                  border: `0.5px solid ${BORDER}`, borderRadius: 20,
                  padding: "5px 10px 5px 5px", background: WHITE, cursor: "pointer", fontFamily: FONT }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: P,
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {localStorage.getItem("tci_avatar")
                    ? <img src={localStorage.getItem("tci_avatar")} alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <User size={13} color="white" />}
                </div>
                <span style={{ fontSize: 13, color: DARK, maxWidth: 100,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.full_name?.split(" ")[0]}
                </span>
                <ChevronDown size={12} color={MUTED} />
              </button>
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    style={{ position: "absolute", top: "calc(100% + 6px)",
                      [isRTL ? "left" : "right"]: 0, background: WHITE,
                      border: `0.5px solid ${BORDER}`, borderRadius: 10,
                      boxShadow: "0 4px 20px rgba(0,0,0,.08)",
                      overflow: "hidden", minWidth: 180, zIndex: 100 }}>
                    <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${BG}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{user.full_name}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{user.email}</div>
                    </div>
                    <button onClick={() => navigate("/profil")} style={menuBtn}>
                      <User size={14} color={P} /> {t("nav_profile")}
                    </button>
                    <button onClick={() => navigate("/profil?tab=reservations")} style={menuBtn}>
                      <Star size={14} color={P} /> {t("nav_reservations")}
                    </button>
                    <button onClick={() => logout()}
                      style={{ ...menuBtn, color: "#DC2626", borderTop: `0.5px solid ${BG}` }}>
                      <LogOut size={14} /> {t("nav_logout")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/connexion")}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "7px 16px",
                  fontSize: 13, background: "transparent", cursor: "pointer",
                  color: DARK, fontWeight: 500, fontFamily: FONT }}>
                {t("nav_login")}
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/inscription")}
                style={{ border: "none", borderRadius: 8, padding: "8px 18px",
                  fontSize: 13, background: P, color: "#1A1000",
                  cursor: "pointer", fontWeight: 700, fontFamily: FONT }}>
                {t("nav_register")}
              </motion.button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ background: WHITE, borderBottom: `0.5px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto",
          display: "grid", gridTemplateColumns: "1fr 420px",
          alignItems: "center", gap: 0, minHeight: 340 }}>

          {/* Texte gauche */}
          <div style={{ padding: "52px 32px 52px 40px" }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 7,
                background: "#FEF6EC", border: `0.5px solid #F0C98A`,
                borderRadius: 20, padding: "4px 14px", marginBottom: 22 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: S }} />
              <span style={{ fontSize: 11, color: "#C47D1A", letterSpacing: "0.3px",
                fontWeight: 600 }}>{t("hero_live")}</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{ fontSize: "clamp(28px, 3.5vw, 42px)", fontWeight: 300, color: DARK,
                lineHeight: 1.1, marginBottom: 16, letterSpacing: "-1px", maxWidth: 520 }}>
              {t("hero_title_1")}<br />
              <span style={{ fontStyle: "italic", color: P }}>{t("hero_title_2")}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              style={{ color: MUTED, fontSize: 14, marginBottom: 32,
                lineHeight: 1.75, maxWidth: 420, fontWeight: 400 }}>
              {t("hero_sub")}
            </motion.p>

            {/* ── Barre OpenTable ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ display: "flex", background: WHITE, borderRadius: 12,
                border: `0.5px solid ${BORDER}`, overflow: "visible",
                maxWidth: 680, boxShadow: "0 2px 20px rgba(30,46,40,.08)" }}>

              {/* Date */}
              <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
                <button onClick={() => toggleFilter("date")}
                  style={filterCell}>
                  <Calendar size={14} color={P} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={filterLbl}>Date</div>
                    <div style={filterVal}>{displayDate}</div>
                  </div>
                  <ChevronDown size={12} color={MUTED} />
                </button>
                {openFilter === "date" && (
                  <CalendarDropdown value={resaDate} onChange={setResaDate}
                    onClose={() => setOpenFilter(null)} />
                )}
              </div>

              <div style={sep} />

              {/* Heure */}
              <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
                <button onClick={() => toggleFilter("time")}
                  style={filterCell}>
                  <Clock size={14} color={P} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={filterLbl}>Heure</div>
                    <div style={filterVal}>{resaTime}</div>
                  </div>
                  <ChevronDown size={12} color={MUTED} />
                </button>
                {openFilter === "time" && (
                  <TimeDropdown value={resaTime} onChange={setResaTime}
                    onClose={() => setOpenFilter(null)} />
                )}
              </div>

              <div style={sep} />

              {/* Personnes */}
              <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
                <button onClick={() => toggleFilter("guests")}
                  style={filterCell}>
                  <Users size={14} color={P} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={filterLbl}>Personnes</div>
                    <div style={filterVal}>{resaGuests} {resaGuests === 1 ? "personne" : "pers."}</div>
                  </div>
                  <ChevronDown size={12} color={MUTED} />
                </button>
                {openFilter === "guests" && (
                  <GuestsDropdown value={resaGuests} onChange={setResaGuests}
                    onClose={() => setOpenFilter(null)} />
                )}
              </div>

              <div style={sep} />

              {/* Recherche texte */}
              <div style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "0 16px", flex: 1 }}>
                <Search size={14} color={MUTED} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={filterLbl}>Recherche</div>
                  <input placeholder="Restaurant, cuisine, quartier…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && scrollTo(listRef)}
                    style={{ border: "none", background: "transparent",
                      fontSize: 13, color: DARK, outline: "none",
                      width: "100%", padding: 0, fontFamily: FONT }} />
                </div>
              </div>

              {/* CTA */}
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => scrollTo(listRef)}
                style={{ background: P, color: "#1A1000", border: "none",
                  borderRadius: "0 11px 11px 0", padding: "0 28px",
                  cursor: "pointer", fontSize: 14, fontWeight: 700,
                  flexShrink: 0, fontFamily: FONT, letterSpacing: "0.2px" }}>
                {t("search_btn")}
              </motion.button>
            </motion.div>
          </div>

          {/* Décor droite */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{ padding: "24px 24px 24px 0", alignSelf: "stretch",
              display: "flex", alignItems: "center" }}>
            <HeroDecor />
          </motion.div>
        </div>
      </div>

      {/* ── Bande déco ────────────────────────────────────────────────────── */}
      <div style={{ height: 3,
        background: `linear-gradient(90deg,${P} 0%,${S} 50%,${P} 100%)`, opacity: 0.22 }} />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div ref={listRef} style={{ display: "flex", padding: "0 32px", background: WHITE,
        borderBottom: `0.5px solid ${BORDER}`, overflowX: "auto" }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: "13px 18px", fontSize: 13, cursor: "pointer",
              background: "transparent", border: "none", whiteSpace: "nowrap",
              color: activeTab === i ? P : MUTED,
              borderBottom: `2px solid ${activeTab === i ? P : "transparent"}`,
              fontWeight: activeTab === i ? 600 : 400, fontFamily: FONT,
              transition: "all .15s" }}>
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px",
          textTransform: "uppercase", color: MUTED, padding: "18px 0 8px" }}>
          {t("results_label")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "clamp(160px,22%,230px) 1fr", gap: 20 }}>

          {/* Filtres */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ background: WHITE, border: `0.5px solid ${BORDER}`,
              borderRadius: 12, padding: 16 }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>
                  {t("filter_cuisine")}
                </div>
                {CUISINES.map(({ key, val }) => (
                  <label key={val} style={{ display: "flex", alignItems: "center",
                    gap: 8, padding: "5px 0", fontSize: 13, color: DARK,
                    cursor: "pointer", fontFamily: FONT }}>
                    <input type="checkbox" checked={!!checkedC[val]}
                      onChange={() => toggle(setCheckedC, val)}
                      style={{ accentColor: P }} />
                    {t(key)}
                  </label>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>
                  {t("filter_specs")}
                </div>
                {SPECS.map(({ key, val }) => (
                  <label key={val} style={{ display: "flex", alignItems: "center",
                    gap: 8, padding: "5px 0", fontSize: 13, color: DARK,
                    cursor: "pointer", fontFamily: FONT }}>
                    <input type="checkbox" style={{ accentColor: P }} />
                    {t(key)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Résultats */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>{resultsText}</span>
              <select value={sort} onChange={e => setSort(e.target.value)}
                style={{ fontSize: 12, border: `0.5px solid ${BORDER}`, borderRadius: 8,
                  padding: "5px 10px", background: WHITE, color: DARK,
                  cursor: "pointer", fontFamily: FONT }}>
                <option value="rating">{t("sort_rating")}</option>
                <option value="reviews">{t("sort_reviews")}</option>
                <option value="recent">{t("sort_recent")}</option>
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
                <div style={{ fontSize: 13, fontFamily: FONT }}>{t("loading")}</div>
              </div>
            ) : restaurants.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
                <UtensilsCrossed size={38} style={{ opacity: 0.25, marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: DARK, fontFamily: FONT }}>
                  {t("no_resto_title")}
                </div>
                <div style={{ fontSize: 13, marginTop: 6, fontFamily: FONT }}>
                  {search ? t("no_resto_search") : t("no_resto_empty")}
                </div>
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show">
                {restaurants.map((r, idx) => (
                  <motion.div key={r.id} variants={fadeUp}
                    whileHover={{ y: -2, boxShadow: "0 4px 18px rgba(30,46,40,.07)" }}
                    onClick={() => navigate(`/restaurants/${r.slug}`)}
                    style={{ display: "grid", gridTemplateColumns: "120px 1fr",
                      border: `0.5px solid ${BORDER}`, borderRadius: 12,
                      overflow: "hidden", marginBottom: 10, background: WHITE,
                      cursor: "pointer", position: "relative", transition: "box-shadow .2s" }}>

                    <div style={{ position: "relative", background: BG,
                      display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110 }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4,
                        background: CARD_ACCENT[idx % CARD_ACCENT.length] }} />
                      <UtensilsCrossed size={30} color={CARD_ACCENT[idx % CARD_ACCENT.length]}
                        style={{ opacity: 0.3 }} />
                    </div>

                    <button onClick={e => toggleFavorite(e, r)}
                      style={{ position: "absolute", top: 8, right: 8, background: WHITE,
                        border: `0.5px solid ${BORDER}`, borderRadius: "50%", width: 28, height: 28,
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <Heart size={12}
                        fill={isFav(r.slug) ? "#DC2626" : "none"}
                        color={isFav(r.slug) ? "#DC2626" : MUTED} />
                    </button>

                    <div style={{ padding: "14px 16px", fontFamily: FONT }}>
                      <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
                        color: CARD_ACCENT[idx % CARD_ACCENT.length], marginBottom: 6, fontWeight: 700 }}>
                        {r.cuisine_type}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: DARK, marginBottom: 5 }}>
                        {r.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Stars rating={r.rating} />
                        <span style={{ fontSize: 11, color: MUTED }}>
                          {r.rating
                            ? `${r.rating} (${r.review_count || 0} ${t("reviews")})`
                            : t("new_resto")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                        {r.quartier && (
                          <span style={{ fontSize: 10, background: BG, color: MUTED,
                            padding: "2px 8px", borderRadius: 10,
                            display: "flex", alignItems: "center", gap: 3 }}>
                            <MapPin size={9} />{r.quartier}
                          </span>
                        )}
                        {r.price_range && (
                          <span style={{ fontSize: 10, background: BG, color: MUTED,
                            padding: "2px 8px", borderRadius: 10 }}>{r.price_range}</span>
                        )}
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px",
                          borderRadius: 7, border: `0.5px solid ${P}55`,
                          background: "#FEF6EC", color: "#C47D1A",
                          cursor: "pointer", fontFamily: FONT }}>
                        {t("see_slots")}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Expériences ─────────────────────────────────────────────────── */}
        <div ref={experiencesRef}
          style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 28, marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: DARK,
            marginBottom: 16, fontFamily: FONT }}>{t("exp_title")}</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {EXPERIENCES.map((e, i) => (
              <motion.div key={i} whileHover={{ y: -3, boxShadow: "0 4px 16px rgba(30,46,40,.07)" }}
                style={{ minWidth: 180, border: `0.5px solid ${BORDER}`, borderRadius: 12,
                  overflow: "hidden", background: WHITE, cursor: "pointer", flexShrink: 0 }}>
                <div style={{ height: 84, background: e.bg,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <e.icon size={32} color={P} style={{ opacity: 0.8 }} />
                </div>
                <div style={{ padding: "10px 14px", fontFamily: FONT }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: DARK, marginBottom: 2 }}>
                    {t(e.nameKey)}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED }}>{t(e.subKey)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Comment ça marche ───────────────────────────────────────────── */}
        <div ref={howRef}
          style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 36, marginBottom: 56 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: DARK,
            marginBottom: 32, textAlign: "center", fontFamily: FONT }}>
            {t("how_title")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {HOW_STEPS.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: WHITE, border: `0.5px solid ${BORDER}`,
                  borderRadius: 14, padding: "24px 20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 10, right: 14, fontSize: 40,
                  fontWeight: 800, color: BG, lineHeight: 1, fontFamily: FONT }}>
                  {step.num}
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FEF6EC",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <step.icon size={19} color={P} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8,
                  color: DARK, fontFamily: FONT }}>
                  {t(step.titleKey)}
                </div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, fontFamily: FONT }}>
                  {t(step.descKey)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Styles partagés ─────────────────────────────────────────────────────────── */
const menuBtn = {
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  padding: "10px 14px", border: "none", background: "white",
  cursor: "pointer", fontSize: 13, color: "#333", fontFamily: FONT,
};

const filterCell = {
  display: "flex", alignItems: "center", gap: 8, padding: "14px 16px",
  background: "transparent", border: "none", cursor: "pointer",
  fontFamily: FONT, whiteSpace: "nowrap",
};

const filterLbl = {
  fontSize: 10, fontWeight: 700, color: MUTED,
  letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2,
};

const filterVal = {
  fontSize: 13, fontWeight: 600, color: DARK,
};

const sep = {
  width: "0.5px", background: BORDER, alignSelf: "stretch", margin: "10px 0",
};

const iconBtn = {
  width: 28, height: 28, borderRadius: "50%", border: `0.5px solid ${BORDER}`,
  background: WHITE, cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", color: DARK,
};
