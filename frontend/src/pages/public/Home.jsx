import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Star, MapPin, Music, Sunrise, Gift, UtensilsCrossed,
  Heart, User, LogOut, Globe, CheckCircle, ChevronDown, BookOpen, Utensils, Sparkles,
} from "lucide-react";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLang } from "../../context/LanguageContext.jsx";

const G    = "#1D9E75";
const DARK = "#0F6E56";

const LANG_LABELS = { fr: "Français", en: "English", ar: "العربية" };
const LANG_FLAGS  = { fr: "🇫🇷", en: "🇬🇧", ar: "🇸🇦" };
const COLORS      = ["#E1F5EE","#FAEEDA","#E6F1FB","#FBEAF0","#FFF3E0","#E3F2FD"];

function Stars({ rating }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12}
          fill={i <= Math.round(rating || 0) ? "#EF9F27" : "none"}
          color={i <= Math.round(rating || 0) ? "#EF9F27" : "#ddd"} />
      ))}
    </div>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

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
  const [favorites,   setFavorites]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("tci_favorites") || "[]"); } catch { return []; }
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLang,     setShowLang]     = useState(false);

  // Tabs traduits dynamiquement
  const TABS = [
    { key: "tab_all",      params: {} },
    { key: "tab_gastro",   params: { cuisine_type: "Gastronomique" } },
    { key: "tab_ivoirian", params: { cuisine_type: "Ivoirienne" } },
    { key: "tab_brunch",   params: { search: "brunch" } },
    { key: "tab_terrace",  params: { search: "terrasse" } },
    { key: "tab_livemusic",params: { search: "jazz" } },
  ];

  const CUISINES = [
    { key: "cuisine_ivoirian",     val: "Ivoirienne" },
    { key: "cuisine_french",       val: "Française" },
    { key: "cuisine_lebanese",     val: "Libanaise" },
    { key: "cuisine_senegalese",   val: "Sénégalaise" },
    { key: "cuisine_international",val: "Internationale" },
  ];
  const SPECS = [
    { key: "spec_terrace",      val: "Terrasse" },
    { key: "spec_livemusic",    val: "Live music" },
    { key: "spec_halal",        val: "Halal" },
    { key: "spec_privatizable", val: "Privatisable" },
    { key: "spec_wifi",         val: "Wifi" },
  ];

  const EXPERIENCES = [
    { icon: Music,           bg: "#E1F5EE", nameKey: "exp_jazz_name",   subKey: "exp_jazz_sub"   },
    { icon: Sunrise,         bg: "#FAEEDA", nameKey: "exp_brunch_name", subKey: "exp_brunch_sub" },
    { icon: Gift,            bg: "#E6F1FB", nameKey: "exp_event_name",  subKey: "exp_event_sub"  },
    { icon: UtensilsCrossed, bg: "#FBEAF0", nameKey: "exp_feast_name",  subKey: "exp_feast_sub"  },
  ];

  const HOW_STEPS = [
    { icon: Search,      titleKey: "how_1_title", descKey: "how_1_desc", num: "01" },
    { icon: BookOpen,    titleKey: "how_2_title", descKey: "how_2_desc", num: "02" },
    { icon: Sparkles,    titleKey: "how_3_title", descKey: "how_3_desc", num: "03" },
  ];

  // Fermer menus au clic dehors
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
      .then(res => {
        setRestaurants(res.data || []);
        setTotal(res.pagination?.total || 0);
      })
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

  const isFav  = (slug) => favorites.some(f => f.slug === slug);
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const resultsText = loading
    ? t("loading")
    : total === 0
      ? t("results_count_0")
      : t("results_count").replace("{n}", total).replace(/{s}/g, total !== 1 ? "s" : "");

  const isRTL = lang === "ar";

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#f7f7f5", minHeight: "100vh",
      direction: isRTL ? "rtl" : "ltr" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px", background: "white", borderBottom: "0.5px solid #eee",
        position: "sticky", top: 0, zIndex: 30, gap: 16 }}>

        {/* Logo */}
        <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18,
            fontWeight: 600, color: G, cursor: "pointer", flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: G,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UtensilsCrossed size={15} color="white" />
          </div>
          TablièreCI
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#666" }}>
          {[
            { key: "nav_restaurants", action: () => scrollTo(listRef) },
            { key: "nav_experiences", action: () => scrollTo(experiencesRef) },
            { key: "nav_how",         action: () => scrollTo(howRef) },
          ].map(({ key, action }) => (
            <span key={key} style={{ cursor: "pointer", whiteSpace: "nowrap" }}
              onClick={action}
              onMouseEnter={e => e.target.style.color = G}
              onMouseLeave={e => e.target.style.color = "#666"}>
              {t(key)}
            </span>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

          {/* Language selector */}
          <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
            <button onClick={() => { setShowLang(p => !p); setShowUserMenu(false); }}
              style={{ display: "flex", alignItems: "center", gap: 5, border: "0.5px solid #eee",
                borderRadius: 8, padding: "6px 10px", background: "white",
                cursor: "pointer", fontSize: 12, color: "#666" }}>
              <Globe size={13} color={G} />
              {LANG_FLAGS[lang]}
            </button>
            <AnimatePresence>
              {showLang && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{ position: "absolute", top: "calc(100% + 6px)",
                    [isRTL ? "left" : "right"]: 0,
                    background: "white", border: "0.5px solid #eee", borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,.1)", overflow: "hidden",
                    minWidth: 140, zIndex: 100 }}>
                  {langs.map(l => (
                    <button key={l} onClick={() => { changeLang(l); setShowLang(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "9px 14px", border: "none",
                        background: l === lang ? "#E1F5EE" : "white",
                        cursor: "pointer", fontSize: 13,
                        color: l === lang ? G : "#444", fontWeight: l === lang ? 500 : 400 }}>
                      {LANG_FLAGS[l]} {LANG_LABELS[l]}
                      {l === lang && <CheckCircle size={12} color={G} style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {user ? (
            <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => { setShowUserMenu(p => !p); setShowLang(false); }}
                style={{ display: "flex", alignItems: "center", gap: 6, border: "0.5px solid #eee",
                  borderRadius: 20, padding: "5px 10px 5px 5px", background: "white", cursor: "pointer" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: G,
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {localStorage.getItem("tci_avatar")
                    ? <img src={localStorage.getItem("tci_avatar")} alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <User size={14} color="white" />}
                </div>
                <span style={{ fontSize: 13, color: "#333", maxWidth: 100,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.full_name?.split(" ")[0]}
                </span>
                <ChevronDown size={12} color="#aaa" />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    style={{ position: "absolute", top: "calc(100% + 6px)",
                      [isRTL ? "left" : "right"]: 0,
                      background: "white", border: "0.5px solid #eee", borderRadius: 10,
                      boxShadow: "0 4px 20px rgba(0,0,0,.1)", overflow: "hidden",
                      minWidth: 180, zIndex: 100 }}>
                    <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #f5f5f5" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{user.full_name}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{user.email}</div>
                    </div>
                    <button onClick={() => navigate("/profil")}
                      style={menuBtnStyle}>
                      <User size={14} color={G} /> {t("nav_profile")}
                    </button>
                    <button onClick={() => navigate("/profil?tab=reservations")}
                      style={menuBtnStyle}>
                      ✦ {t("nav_reservations")}
                    </button>
                    <button onClick={() => logout()}
                      style={{ ...menuBtnStyle, color: "#DC2626", borderTop: "0.5px solid #f5f5f5" }}>
                      <LogOut size={14} /> {t("nav_logout")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/connexion")}
                style={{ border: "0.5px solid #ddd", borderRadius: 8, padding: "6px 14px",
                  fontSize: 13, background: "transparent", cursor: "pointer", color: "#444" }}>
                {t("nav_login")}
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/inscription")}
                style={{ border: "none", borderRadius: 8, padding: "7px 16px",
                  fontSize: 13, background: G, color: "white", cursor: "pointer", fontWeight: 500 }}>
                {t("nav_register")}
              </motion.button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ background: DARK, padding: "44px 28px 36px", textAlign: "center" }}>
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: 30, fontWeight: 600, color: "white", marginBottom: 8 }}>
          {t("hero_title")}
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          style={{ color: "#9FE1CB", fontSize: 14, marginBottom: 28 }}>
          {t("hero_sub")}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ display: "flex", background: "white", borderRadius: 12, overflow: "hidden",
            maxWidth: 600, margin: "0 auto", border: "0.5px solid #ddd",
            boxShadow: "0 4px 24px rgba(0,0,0,.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "11px 16px", flex: 1, borderRight: "0.5px solid #f0f0f0" }}>
            <Search size={15} color="#bbb" style={{ flexShrink: 0 }} />
            <input placeholder={t("search_placeholder")}
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && scrollTo(listRef)}
              style={{ border: "none", background: "transparent", fontSize: 13,
                color: "#333", outline: "none", width: "100%" }} />
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => scrollTo(listRef)}
            style={{ background: G, color: "white", border: "none", padding: "0 22px",
              cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex",
              alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Search size={14} />{t("search_btn")}
          </motion.button>
        </motion.div>
      </div>

      {/* ── Tabs filtre ──────────────────────────────────────────────────── */}
      <div ref={listRef} style={{ display: "flex", padding: "0 28px", background: "white",
        borderBottom: "0.5px solid #eee", overflowX: "auto" }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: "12px 16px", fontSize: 13, cursor: "pointer",
              background: "transparent", border: "none", whiteSpace: "nowrap",
              color: activeTab === i ? G : "#777",
              borderBottom: `2px solid ${activeTab === i ? G : "transparent"}`,
              fontWeight: activeTab === i ? 500 : 400 }}>
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.8px",
          textTransform: "uppercase", color: "#aaa", padding: "18px 0 8px" }}>
          {t("results_label")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "clamp(160px,22%,230px) 1fr", gap: 16 }}>

          {/* Filtres */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ background: "white", border: "0.5px solid #eee", borderRadius: 12, padding: "14px 14px" }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa",
                  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  {t("filter_cuisine")}
                </div>
                {CUISINES.map(({ key, val }) => (
                  <label key={val} style={{ display: "flex", alignItems: "center",
                    gap: 8, padding: "4px 0", fontSize: 13, color: "#444", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!checkedC[val]}
                      onChange={() => toggle(setCheckedC, val)}
                      style={{ accentColor: G }} />
                    {t(key)}
                  </label>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa",
                  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  {t("filter_specs")}
                </div>
                {SPECS.map(({ key, val }) => (
                  <label key={val} style={{ display: "flex", alignItems: "center",
                    gap: 8, padding: "4px 0", fontSize: 13, color: "#444", cursor: "pointer" }}>
                    <input type="checkbox" style={{ accentColor: G }} />
                    {t(key)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Résultats */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: "#666" }}>{resultsText}</span>
              <select value={sort} onChange={e => setSort(e.target.value)}
                style={{ fontSize: 13, border: "0.5px solid #ddd", borderRadius: 8,
                  padding: "5px 10px", background: "white", color: "#444", cursor: "pointer" }}>
                <option value="rating">{t("sort_rating")}</option>
                <option value="reviews">{t("sort_reviews")}</option>
                <option value="recent">{t("sort_recent")}</option>
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
                <div style={{ fontSize: 13 }}>{t("loading")}</div>
              </div>
            ) : restaurants.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
                <UtensilsCrossed size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 500 }}>{t("no_resto_title")}</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  {search ? t("no_resto_search") : t("no_resto_empty")}
                </div>
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show">
                {restaurants.map((r, idx) => (
                  <motion.div key={r.id} variants={fadeUp}
                    whileHover={{ y: -2, boxShadow: "0 4px 18px rgba(0,0,0,.08)" }}
                    onClick={() => navigate(`/restaurants/${r.slug}`)}
                    style={{ display: "grid", gridTemplateColumns: "130px 1fr",
                      border: "0.5px solid #eee", borderRadius: 12, overflow: "hidden",
                      marginBottom: 12, background: "white", cursor: "pointer", position: "relative" }}>

                    <div style={{ background: COLORS[idx % COLORS.length],
                      display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120 }}>
                      <UtensilsCrossed size={36} color={G} style={{ opacity: 0.5 }} />
                    </div>

                    <button onClick={(e) => toggleFavorite(e, r)}
                      style={{ position: "absolute", top: 8, right: 8, background: "white",
                        border: "0.5px solid #eee", borderRadius: "50%", width: 28, height: 28,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
                      <Heart size={13}
                        fill={isFav(r.slug) ? "#DC2626" : "none"}
                        color={isFav(r.slug) ? "#DC2626" : "#bbb"} />
                    </button>

                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{r.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                        <Stars rating={r.rating} />
                        <span style={{ fontSize: 12, color: "#999" }}>
                          {r.rating ? `${r.rating} (${r.review_count || 0} ${t("reviews")})` : t("new_resto")}
                        </span>
                        <span style={{ fontSize: 11, background: "#f5f5f5", color: "#666",
                          padding: "2px 8px", borderRadius: 10 }}>{r.cuisine_type}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        {r.quartier && (
                          <span style={{ fontSize: 11, background: "#f5f5f5", color: "#666",
                            padding: "2px 8px", borderRadius: 10, display: "flex", alignItems: "center", gap: 3 }}>
                            <MapPin size={10} />{r.quartier}
                          </span>
                        )}
                        {r.price_range && (
                          <span style={{ fontSize: 11, background: "#f5f5f5", color: "#666",
                            padding: "2px 8px", borderRadius: 10 }}>{r.price_range}</span>
                        )}
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        style={{ fontSize: 12, fontWeight: 500, padding: "6px 14px",
                          borderRadius: 7, border: `0.5px solid ${G}55`,
                          background: "#E1F5EE", color: DARK, cursor: "pointer" }}>
                        {t("see_slots")}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Expériences ──────────────────────────────────────────────── */}
        <div ref={experiencesRef} style={{ borderTop: "0.5px solid #eee", paddingTop: 24, marginBottom: 32 }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 14 }}>{t("exp_title")}</div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
            {EXPERIENCES.map((e, i) => (
              <motion.div key={i} whileHover={{ y: -3, boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}
                style={{ minWidth: 180, border: "0.5px solid #eee", borderRadius: 12,
                  overflow: "hidden", background: "white", cursor: "pointer", flexShrink: 0 }}>
                <div style={{ height: 90, background: e.bg,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <e.icon size={34} color={DARK} style={{ opacity: 0.7 }} />
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{t(e.nameKey)}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>{t(e.subKey)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Comment ça marche ────────────────────────────────────────── */}
        <div ref={howRef} style={{ borderTop: "0.5px solid #eee", paddingTop: 32, marginBottom: 48 }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 28, textAlign: "center" }}>
            {t("how_title")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {HOW_STEPS.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: "white", border: "0.5px solid #eee", borderRadius: 14,
                  padding: "24px 20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 12, right: 16, fontSize: 32,
                  fontWeight: 800, color: "#f0f0f0", lineHeight: 1 }}>{step.num}</div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#E1F5EE",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <step.icon size={20} color={G} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#1a1a1a" }}>
                  {t(step.titleKey)}
                </div>
                <div style={{ fontSize: 13, color: "#777", lineHeight: 1.6 }}>
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

const menuBtnStyle = {
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  padding: "10px 14px", border: "none", background: "white",
  cursor: "pointer", fontSize: 13, color: "#333",
};
