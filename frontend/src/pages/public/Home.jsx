import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Calendar, Clock, Users, Star, MapPin,
  Music, Sunrise, Gift, UtensilsCrossed, ChevronDown,
} from "lucide-react";

const G = "#1D9E75";
const DARK = "#0F6E56";

const RESTAURANTS = [
  {
    id: 1,
    name: "Le Maquis du Plateau",
    rating: 4.8, reviews: 213,
    cuisine: "Cuisine ivoirienne",
    tags: ["Attiéké · Poisson braisé", "Terrasse"],
    badge: "Top réservé",
    quartier: "Plateau",
    slots: ["19h30", "20h00", null, "21h00"],
    color: "#E1F5EE",
  },
  {
    id: 2,
    name: "La Terrasse d'Abidjan",
    rating: 4.5, reviews: 98,
    cuisine: "Française · Grillades",
    tags: ["Vue sur lagune", "Live jazz vendredi"],
    badge: null,
    quartier: "Cocody",
    slots: [null, "20h00", "20h30", null],
    color: "#FAEEDA",
  },
  {
    id: 3,
    name: "Saveurs de Cocody",
    rating: 4.9, reviews: 47,
    cuisine: "Gastronomique",
    tags: ["Menu dégustation"],
    badge: "Nouveau",
    quartier: "Cocody",
    slots: ["19h00", "19h30", "21h00"],
    color: "#E6F1FB",
  },
];

const EXPERIENCES = [
  { icon: Music,         bg: "#E1F5EE", name: "Dîner live jazz",    sub: "Vendredi & samedi soir"     },
  { icon: Sunrise,       bg: "#FAEEDA", name: "Brunch du dimanche", sub: "Tables en bord de lagune"   },
  { icon: Gift,          bg: "#E6F1FB", name: "Privatisation",      sub: "Anniversaire & évènements"  },
  { icon: UtensilsCrossed, bg: "#FBEAF0", name: "Menu spécial fête", sub: "Tabaski · Noël · Nouvel An" },
];

const TABS = ["Tous", "Gastronomique", "Cuisine ivoirienne", "Brunch", "Terrasse", "Live musique"];

const QUARTIERS = [
  { name: "Plateau",    count: 12 },
  { name: "Cocody",     count: 8  },
  { name: "Marcory",    count: 5  },
  { name: "Treichville",count: 4  },
  { name: "Yopougon",   count: 3  },
];

const CUISINES = ["Ivoirienne","Française","Libanaise","Sénégalaise","Internationale"];
const BUDGETS  = ["Économique (< 5 000 F)","Moyen (5–20 000 F)","Premium (> 20 000 F)"];
const SPECS    = ["Terrasse","Live music","Halal","Privatisable","Wifi"];

function Stars({ rating }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12}
          fill={i <= Math.round(rating) ? "#EF9F27" : "none"}
          color={i <= Math.round(rating) ? "#EF9F27" : "#ddd"} />
      ))}
    </div>
  );
}

function Slot({ time }) {
  const full = !time;
  return (
    <motion.div whileHover={!full ? { scale: 1.04 } : {}} whileTap={!full ? { scale: 0.97 } : {}}
      style={{
        fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 7,
        border: `0.5px solid ${full ? "#e5e5e5" : "#5DCAA5"}`,
        background: full ? "#f7f7f5" : "#E1F5EE",
        color: full ? "#ccc" : DARK,
        textDecoration: full ? "line-through" : "none",
        cursor: full ? "default" : "pointer",
      }}>
      {time || "complet"}
    </motion.div>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Home() {
  const navigate = useNavigate();
  const [activeTab,    setActiveTab]    = useState("Tous");
  const [checkedQ,     setCheckedQ]     = useState({ Plateau: true });
  const [checkedC,     setCheckedC]     = useState({ Ivoirienne: true, Française: true });
  const [checkedB,     setCheckedB]     = useState({ "Moyen (5–20 000 F)": true });
  const [checkedS,     setCheckedS]     = useState({});
  const [sort,         setSort]         = useState("Meilleure note");

  const toggle = (setter, key) =>
    setter(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#f7f7f5", minHeight: "100vh" }}>

      {/* ── Nav ── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px", background: "white", borderBottom: "0.5px solid #eee",
        position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18,
          fontWeight: 600, color: G }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: G,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UtensilsCrossed size={15} color="white" />
          </div>
          TablièreCI
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#666" }}>
          {["Restaurants","Expériences","Pour les pros"].map(l => (
            <span key={l} style={{ cursor: "pointer" }}
              onMouseEnter={e => e.target.style.color = G}
              onMouseLeave={e => e.target.style.color = "#666"}>{l}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/connexion")}
            style={{ border: "0.5px solid #ddd", borderRadius: 8, padding: "6px 14px",
              fontSize: 13, background: "transparent", cursor: "pointer", color: "#444" }}>
            Connexion
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/inscription")}
            style={{ border: "none", borderRadius: 8, padding: "7px 16px",
              fontSize: 13, background: G, color: "white", cursor: "pointer", fontWeight: 500 }}>
            + Inscription
          </motion.button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{ background: DARK, padding: "44px 28px 36px", textAlign: "center" }}>
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: 30, fontWeight: 600, color: "white", marginBottom: 8 }}>
          Réservez votre table en Côte d'Ivoire
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          style={{ color: "#9FE1CB", fontSize: 14, marginBottom: 28 }}>
          Abidjan · Yamoussoukro · Bouaké · et toute la Côte d'Ivoire
        </motion.p>

        {/* Search bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ display: "flex", background: "white", borderRadius: 12, overflow: "hidden",
            maxWidth: 740, margin: "0 auto", border: "0.5px solid #ddd",
            boxShadow: "0 4px 24px rgba(0,0,0,.15)" }}>
          {[
            { icon: Search,   placeholder: "Restaurant, cuisine, quartier...", flex: 2 },
            { icon: Calendar, placeholder: "Aujourd'hui" },
            { icon: Clock,    placeholder: "20h00" },
            { icon: Users,    placeholder: "2 personnes" },
          ].map(({ icon: Icon, placeholder, flex }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "11px 16px", flex: flex || 1,
              borderRight: i < 3 ? "0.5px solid #f0f0f0" : "none" }}>
              <Icon size={15} color="#bbb" style={{ flexShrink: 0 }} />
              <input placeholder={placeholder}
                style={{ border: "none", background: "transparent", fontSize: 13,
                  color: "#333", outline: "none", width: "100%" }} />
            </div>
          ))}
          <motion.button whileTap={{ scale: 0.97 }}
            style={{ background: G, color: "white", border: "none", padding: "0 22px",
              cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex",
              alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Search size={14} />Trouver
          </motion.button>
        </motion.div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 0, padding: "0 28px", background: "white",
        borderBottom: "0.5px solid #eee" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "12px 16px", fontSize: 13, cursor: "pointer",
              background: "transparent", border: "none",
              color: activeTab === t ? G : "#777",
              borderBottom: `2px solid ${activeTab === t ? G : "transparent"}`,
              fontWeight: activeTab === t ? 500 : 400 }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Main ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.8px",
          textTransform: "uppercase", color: "#aaa", padding: "18px 0 8px" }}>
          Résultats — Abidjan
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20 }}>

          {/* Sidebar filtres */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ background: "white", border: "0.5px solid #eee",
              borderRadius: 12, padding: "14px 16px" }}>

              {[
                { title: "Quartier",          items: QUARTIERS.map(q => q.name), counts: Object.fromEntries(QUARTIERS.map(q => [q.name, q.count])), checked: checkedQ, setter: setCheckedQ },
                { title: "Type de cuisine",   items: CUISINES,  checked: checkedC, setter: setCheckedC },
                { title: "Budget",            items: BUDGETS,   checked: checkedB, setter: setCheckedB },
                { title: "Spécificités",      items: SPECS,     checked: checkedS, setter: setCheckedS },
              ].map(({ title, items, counts, checked, setter }) => (
                <div key={title} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa",
                    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                    {title}
                  </div>
                  {items.map(item => (
                    <label key={item} style={{ display: "flex", alignItems: "center",
                      gap: 8, padding: "4px 0", fontSize: 13, color: "#444", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!checked[item]}
                        onChange={() => toggle(setter, item)}
                        style={{ accentColor: G }} />
                      {item}
                      {counts?.[item] && (
                        <span style={{ marginLeft: "auto", fontSize: 11, padding: "1px 7px",
                          borderRadius: 10,
                          background: checked[item] ? "#E1F5EE" : "#f5f5f5",
                          color: checked[item] ? DARK : "#aaa" }}>
                          {counts[item]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Résultats */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: "#666" }}>
                32 restaurants disponibles ce soir
              </span>
              <select value={sort} onChange={e => setSort(e.target.value)}
                style={{ fontSize: 13, border: "0.5px solid #ddd", borderRadius: 8,
                  padding: "5px 10px", background: "white", color: "#444", cursor: "pointer" }}>
                <option>Meilleure note</option>
                <option>Plus proches</option>
                <option>Disponibilité</option>
              </select>
            </div>

            <motion.div variants={stagger} initial="hidden" animate="show">
              {RESTAURANTS.map(r => (
                <motion.div key={r.id} variants={fadeUp}
                  whileHover={{ y: -2, boxShadow: "0 4px 18px rgba(0,0,0,.08)" }}
                  onClick={() => navigate(`/restaurants/${r.id}`)}
                  style={{ display: "grid", gridTemplateColumns: "130px 1fr",
                    border: "0.5px solid #eee", borderRadius: 12, overflow: "hidden",
                    marginBottom: 12, background: "white", cursor: "pointer" }}>

                  {/* Image placeholder */}
                  <div style={{ background: r.color, display: "flex",
                    alignItems: "center", justifyContent: "center", minHeight: 120 }}>
                    <UtensilsCrossed size={36} color={G} style={{ opacity: 0.5 }} />
                  </div>

                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{r.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                      <Stars rating={r.rating} />
                      <span style={{ fontSize: 12, color: "#999" }}>{r.rating} ({r.reviews} avis)</span>
                      <span style={{ fontSize: 11, background: "#f5f5f5", color: "#666",
                        padding: "2px 8px", borderRadius: 10 }}>{r.cuisine}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {r.tags.map((t, i) => (
                        <span key={i} style={{ fontSize: 11, background: "#f5f5f5", color: "#666",
                          padding: "2px 8px", borderRadius: 10 }}>{t}</span>
                      ))}
                      {r.badge && (
                        <span style={{ fontSize: 11, background: "#FAEEDA", color: "#854F0B",
                          padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>{r.badge}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {r.slots.map((s, i) => <Slot key={i} time={s} />)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Expériences */}
        <div style={{ borderTop: "0.5px solid #eee", paddingTop: 24, marginBottom: 32 }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 14 }}>
            Expériences à ne pas manquer
          </div>
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
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>{e.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
