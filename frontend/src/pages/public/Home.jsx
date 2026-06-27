import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Star, MapPin, Music, Sunrise, Gift, UtensilsCrossed,
  Heart, User, LogOut, Globe, CheckCircle, ChevronDown, BookOpen, Sparkles,
} from "lucide-react";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLang } from "../../context/LanguageContext.jsx";

// ── Design tokens ─────────────────────────────────────────────────────────────
const P      = "#E8A045";   // or pêche primaire
const S      = "#3D6B55";   // sauge secondaire
const DARK   = "#1E2E28";   // forêt texte
const BG     = "#F8F5EF";   // sable fond canvas
const WHITE  = "#FFFFFF";   // surfaces actives
const BORDER = "#E4DFD8";   // bordures
const MUTED  = "#9BA89F";   // texte secondaire
const CARD_ACCENT = ["#E8A045","#3D6B55","#1E2E28","#B07A3A","#5A8A6A","#2E4A3A"];

// ── Logo SVG ─────────────────────────────────────────────────────────────────
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

const LANG_LABELS = { fr: "Français", en: "English", ar: "العربية" };
const LANG_FLAGS  = { fr: "🇫🇷", en: "🇬🇧", ar: "🇸🇦" };

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function Home() {
  const navigate              = useNavigate();
  const { user, logout }      = useAuth();
  const { lang, t, changeLang, langs } = useLang();
  const listRef               = useRef(null);
  const experiencesRef        = useRef(null);
  const howRef                = useRef(null);

  const [restaurants, setRestaurants] = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [activeTab,   setActiveTab]   = useState(0);
  const [sort,        setSort]        = useState("rating");
  const [checkedC,    setCheckedC]    = useState({});

  // Filtres OpenTable-style
  const todayStr = new Date().toISOString().split("T")[0];
  const [resaDate,   setResaDate]   = useState(todayStr);
  const [resaTime,   setResaTime]   = useState("19:00");
  const [resaGuests, setResaGuests] = useState(2);
  const [favorites,   setFavorites]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("tci_favorites") || "[]"); } catch { return []; }
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLang,     setShowLang]     = useState(false);

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
    { icon: Search,      titleKey: "how_1_title", descKey: "how_1_desc", num: "01" },
    { icon: BookOpen,    titleKey: "how_2_title", descKey: "how_2_desc", num: "02" },
    { icon: Sparkles,    titleKey: "how_3_title", descKey: "how_3_desc", num: "03" },
  ];

  useEffect(() => {
    const close = () => { setShowUserMenu(false); setShowLang(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const params = { ...TABS[activeTab].params };
    if (search) params.search = search;
    if (sort !== "rating") params.sort = sort;
    const cuisineKeys = Object.entries(checkedC).filter(([,v]) => v).map(([k]) => k);
    if (cuisineKeys.length === 1) params.cuisine_type = cuisineKeys[0];

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

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: BG, minHeight: "100vh",
      direction: isRTL ? "rtl" : "ltr" }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px", background: WHITE, borderBottom: `0.5px solid ${BORDER}`,
        position: "sticky", top: 0, zIndex: 30, gap: 16 }}>

        <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flexShrink: 0 }}>
          <Logo size={28} />
          <span style={{ fontSize: 16, fontWeight: 500, color: DARK, letterSpacing: "-0.3px" }}>
            Tablière<span style={{ color: P }}>CI</span>
          </span>
        </div>

        <div style={{ display: "flex", gap: 26, fontSize: 13, color: MUTED }}>
          {[
            { key: "nav_restaurants", action: () => scrollTo(listRef) },
            { key: "nav_experiences", action: () => scrollTo(experiencesRef) },
            { key: "nav_how",         action: () => scrollTo(howRef) },
          ].map(({ key, action }) => (
            <span key={key} style={{ cursor: "pointer", whiteSpace: "nowrap", transition: "color .15s" }}
              onClick={action}
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
                padding: "6px 10px", background: WHITE, cursor: "pointer", fontSize: 12, color: MUTED }}>
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
                    boxShadow: "0 4px 20px rgba(0,0,0,.08)", overflow: "hidden",
                    minWidth: 140, zIndex: 100 }}>
                  {langs.map(l => (
                    <button key={l} onClick={() => { changeLang(l); setShowLang(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "9px 14px", border: "none",
                        background: l === lang ? "#FEF6EC" : WHITE,
                        cursor: "pointer", fontSize: 13,
                        color: l === lang ? P : "#444", fontWeight: l === lang ? 500 : 400 }}>
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
                  padding: "5px 10px 5px 5px", background: WHITE, cursor: "pointer" }}>
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
                      boxShadow: "0 4px 20px rgba(0,0,0,.08)", overflow: "hidden",
                      minWidth: 180, zIndex: 100 }}>
                    <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${BG}` }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{user.full_name}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{user.email}</div>
                    </div>
                    <button onClick={() => navigate("/profil")} style={menuBtnStyle(P)}>
                      <User size={14} color={P} /> {t("nav_profile")}
                    </button>
                    <button onClick={() => navigate("/profil?tab=reservations")} style={menuBtnStyle(P)}>
                      <Star size={14} color={P} /> {t("nav_reservations")}
                    </button>
                    <button onClick={() => logout()}
                      style={{ ...menuBtnStyle(P), color: "#DC2626", borderTop: `0.5px solid ${BG}` }}>
                      <LogOut size={14} /> {t("nav_logout")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/connexion")}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "7px 14px",
                  fontSize: 13, background: "transparent", cursor: "pointer", color: DARK }}>
                {t("nav_login")}
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/inscription")}
                style={{ border: "none", borderRadius: 8, padding: "7px 18px",
                  fontSize: 13, background: P, color: "#1A1000", cursor: "pointer", fontWeight: 600 }}>
                {t("nav_register")}
              </motion.button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ background: WHITE, padding: "52px 28px 44px", borderBottom: `0.5px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 7,
              background: "#FEF6EC", border: `0.5px solid #F0C98A`,
              borderRadius: 20, padding: "4px 14px", marginBottom: 22 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: P }} />
            <span style={{ fontSize: 12, color: "#C47D1A", letterSpacing: "0.3px" }}>
              {t("hero_live")}
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: "clamp(30px, 4vw, 44px)", fontWeight: 300, color: DARK,
              lineHeight: 1.1, marginBottom: 16, letterSpacing: "-1px", maxWidth: 560 }}>
            {t("hero_title_1")}<br />
            <span style={{ fontStyle: "italic", color: P }}>{t("hero_title_2")}</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            style={{ color: MUTED, fontSize: 14, marginBottom: 32, lineHeight: 1.75, maxWidth: 440 }}>
            {t("hero_sub")}
          </motion.p>

          {/* Barre OpenTable-style */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ display: "flex", background: WHITE, borderRadius: 12, overflow: "hidden",
              maxWidth: 780, border: `0.5px solid ${BORDER}`,
              boxShadow: "0 2px 16px rgba(30,46,40,.07)" }}>

            {/* Date */}
            <div style={filterCell}>
              <div style={filterLabel}>📅 {t("filter_date") || "Date"}</div>
              <input type="date" value={resaDate} min={todayStr}
                onChange={e => setResaDate(e.target.value)}
                style={filterInput} />
            </div>
            <div style={divider} />

            {/* Heure */}
            <div style={filterCell}>
              <div style={filterLabel}>🕐 {t("filter_time") || "Heure"}</div>
              <select value={resaTime} onChange={e => setResaTime(e.target.value)}
                style={filterInput}>
                {["11:30","12:00","12:30","13:00","13:30","18:00","18:30",
                  "19:00","19:30","20:00","20:30","21:00","21:30","22:00"].map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div style={divider} />

            {/* Personnes */}
            <div style={filterCell}>
              <div style={filterLabel}>👤 {t("filter_guests") || "Personnes"}</div>
              <select value={resaGuests} onChange={e => setResaGuests(Number(e.target.value))}
                style={filterInput}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? "personne" : "personnes"}</option>
                ))}
              </select>
            </div>
            <div style={divider} />

            {/* Recherche texte */}
            <div style={{ ...filterCell, flex: 2 }}>
              <div style={filterLabel}>🔍 {t("search_placeholder") || "Recherche"}</div>
              <input placeholder="Restaurant, cuisine, quartier…"
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && scrollTo(listRef)}
                style={{ ...filterInput, minWidth: 160 }} />
            </div>

            {/* CTA */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => scrollTo(listRef)}
              style={{ background: P, color: "#1A1000", border: "none",
                padding: "0 28px", cursor: "pointer", fontSize: 14,
                fontWeight: 700, flexShrink: 0, letterSpacing: "0.2px" }}>
              {t("search_btn")}
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* ── Bande déco ────────────────────────────────────────────────────── */}
      <div style={{ height: 3, background: `linear-gradient(90deg,${P} 0%,${S} 50%,${P} 100%)`, opacity: 0.22 }} />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div ref={listRef} style={{ display: "flex", padding: "0 28px", background: WHITE,
        borderBottom: `0.5px solid ${BORDER}`, overflowX: "auto" }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: "12px 16px", fontSize: 13, cursor: "pointer",
              background: "transparent", border: "none", whiteSpace: "nowrap",
              color: activeTab === i ? P : MUTED,
              borderBottom: `2px solid ${activeTab === i ? P : "transparent"}`,
              fontWeight: activeTab === i ? 500 : 400, transition: "all .15s" }}>
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.8px",
          textTransform: "uppercase", color: MUTED, padding: "18px 0 8px" }}>
          {t("results_label")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "clamp(160px,22%,230px) 1fr", gap: 16 }}>

          {/* Filtres */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ background: WHITE, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>
                  {t("filter_cuisine")}
                </div>
                {CUISINES.map(({ key, val }) => (
                  <label key={val} style={{ display: "flex", alignItems: "center",
                    gap: 8, padding: "4px 0", fontSize: 13, color: DARK, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!checkedC[val]}
                      onChange={() => toggle(setCheckedC, val)}
                      style={{ accentColor: P }} />
                    {t(key)}
                  </label>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>
                  {t("filter_specs")}
                </div>
                {SPECS.map(({ key, val }) => (
                  <label key={val} style={{ display: "flex", alignItems: "center",
                    gap: 8, padding: "4px 0", fontSize: 13, color: DARK, cursor: "pointer" }}>
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
              <span style={{ fontSize: 13, color: MUTED }}>{resultsText}</span>
              <select value={sort} onChange={e => setSort(e.target.value)}
                style={{ fontSize: 12, border: `0.5px solid ${BORDER}`, borderRadius: 8,
                  padding: "5px 10px", background: WHITE, color: DARK, cursor: "pointer" }}>
                <option value="rating">{t("sort_rating")}</option>
                <option value="reviews">{t("sort_reviews")}</option>
                <option value="recent">{t("sort_recent")}</option>
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
                <div style={{ fontSize: 13 }}>{t("loading")}</div>
              </div>
            ) : restaurants.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
                <UtensilsCrossed size={38} style={{ opacity: 0.25, marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 500, color: DARK }}>{t("no_resto_title")}</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>
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

                    {/* Bloc image placeholder avec barre couleur */}
                    <div style={{ position: "relative", background: BG,
                      display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110 }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4,
                        background: CARD_ACCENT[idx % CARD_ACCENT.length] }} />
                      <UtensilsCrossed size={32} color={CARD_ACCENT[idx % CARD_ACCENT.length]} style={{ opacity: 0.35 }} />
                    </div>

                    {/* Favori */}
                    <button onClick={e => toggleFavorite(e, r)}
                      style={{ position: "absolute", top: 8, right: 8, background: WHITE,
                        border: `0.5px solid ${BORDER}`, borderRadius: "50%", width: 28, height: 28,
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <Heart size={12}
                        fill={isFav(r.slug) ? "#DC2626" : "none"}
                        color={isFav(r.slug) ? "#DC2626" : MUTED} />
                    </button>

                    <div style={{ padding: "14px 16px" }}>
                      {/* Badge catégorie */}
                      <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
                        color: CARD_ACCENT[idx % CARD_ACCENT.length], marginBottom: 6, fontWeight: 500 }}>
                        {r.cuisine_type}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: DARK, marginBottom: 5 }}>{r.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Stars rating={r.rating} />
                        <span style={{ fontSize: 11, color: MUTED }}>
                          {r.rating ? `${r.rating} (${r.review_count || 0} ${t("reviews")})` : t("new_resto")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                        {r.quartier && (
                          <span style={{ fontSize: 10, background: BG, color: MUTED,
                            padding: "2px 8px", borderRadius: 10, display: "flex", alignItems: "center", gap: 3 }}>
                            <MapPin size={9} />{r.quartier}
                          </span>
                        )}
                        {r.price_range && (
                          <span style={{ fontSize: 10, background: BG, color: MUTED,
                            padding: "2px 8px", borderRadius: 10 }}>{r.price_range}</span>
                        )}
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        style={{ fontSize: 12, fontWeight: 500, padding: "6px 14px",
                          borderRadius: 7, border: `0.5px solid ${P}55`,
                          background: "#FEF6EC", color: "#C47D1A", cursor: "pointer" }}>
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
        <div ref={experiencesRef} style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 28, marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: DARK, marginBottom: 16 }}>{t("exp_title")}</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {EXPERIENCES.map((e, i) => (
              <motion.div key={i} whileHover={{ y: -3, boxShadow: "0 4px 16px rgba(30,46,40,.07)" }}
                style={{ minWidth: 180, border: `0.5px solid ${BORDER}`, borderRadius: 12,
                  overflow: "hidden", background: WHITE, cursor: "pointer", flexShrink: 0 }}>
                <div style={{ height: 84, background: e.bg,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <e.icon size={32} color={P} style={{ opacity: 0.8 }} />
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: DARK, marginBottom: 2 }}>{t(e.nameKey)}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{t(e.subKey)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Comment ça marche ───────────────────────────────────────────── */}
        <div ref={howRef} style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 36, marginBottom: 56 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: DARK, marginBottom: 32, textAlign: "center" }}>
            {t("how_title")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {HOW_STEPS.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: WHITE, border: `0.5px solid ${BORDER}`, borderRadius: 14,
                  padding: "24px 20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 10, right: 14, fontSize: 36,
                  fontWeight: 700, color: BG, lineHeight: 1 }}>{step.num}</div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FEF6EC",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <step.icon size={19} color={P} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: DARK }}>
                  {t(step.titleKey)}
                </div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>
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

const menuBtnStyle = () => ({
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  padding: "10px 14px", border: "none", background: "white",
  cursor: "pointer", fontSize: 13, color: "#333",
});

// Styles barre de recherche OpenTable-style
const filterCell = {
  display: "flex", flexDirection: "column", justifyContent: "center",
  padding: "10px 16px", flex: 1, minWidth: 100, cursor: "pointer",
};
const filterLabel = {
  fontSize: 10, fontWeight: 600, color: "#9BA89F",
  letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 3,
  whiteSpace: "nowrap",
};
const filterInput = {
  border: "none", background: "transparent", fontSize: 13, color: "#1E2E28",
  outline: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
  appearance: "none", WebkitAppearance: "none",
};
const divider = {
  width: "0.5px", background: "#E4DFD8", alignSelf: "stretch", margin: "10px 0",
};
