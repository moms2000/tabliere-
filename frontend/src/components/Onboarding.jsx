import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, CheckCircle, CalendarHeart, ArrowRight } from "lucide-react";

const P     = "#E8A045";
const S     = "#3D6B55";
const DARK  = "#1E2E28";
const CREAM = "#F8F5EF";
const FONT  = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const SERIF = "'Cormorant Garamond','Playfair Display',Georgia,serif";

const SLIDES = [
  {
    icon: UtensilsCrossed,
    tag: "Les meilleures tables",
    title: "Réservez en quelques secondes",
    text: "Découvrez les plus belles adresses de Côte d'Ivoire et réservez votre table en un geste.",
    bg: DARK,
  },
  {
    icon: CheckCircle,
    tag: "Sans effort",
    title: "Confirmation immédiate, zéro frais",
    text: "Votre réservation est confirmée instantanément. Annulez gratuitement à tout moment.",
    bg: S,
  },
  {
    icon: CalendarHeart,
    tag: "Votre espace",
    title: "Suivez tout, gagnez des points",
    text: "Retrouvez vos réservations, vos favoris et cumulez des récompenses à chaque visite.",
    bg: P,
  },
];

const KEY = "tci_onboarded";

export default function Onboarding() {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(KEY) !== "1"; } catch { return false; }
  });
  const [i, setI] = useState(0);

  if (!visible) return null;

  const finish = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setVisible(false);
  };
  const next = () => (i < SLIDES.length - 1 ? setI(i + 1) : finish());

  const s = SLIDES[i];
  const Icon = s.icon;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: CREAM,
      display: "flex", flexDirection: "column", fontFamily: FONT,
      paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>

      {/* Skip */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 18px" }}>
        <button onClick={finish}
          style={{ background: "transparent", border: "none", color: "#9BA89F",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
          Passer
        </button>
      </div>

      {/* Illustration */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "0 28px", textAlign: "center" }}>
        <AnimatePresence mode="wait">
          <motion.div key={i}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 128, height: 128, borderRadius: 36, background: s.bg,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 34,
              boxShadow: `0 18px 44px ${s.bg}44` }}>
              <Icon size={54} color="white" strokeWidth={1.6} />
            </div>
            <div style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase",
              color: P, fontWeight: 700, marginBottom: 12 }}>{s.tag}</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1.15, color: DARK,
              fontWeight: 600, margin: "0 0 14px", maxWidth: 320 }}>{s.title}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#6B7770", maxWidth: 300, margin: 0 }}>
              {s.text}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots + CTA */}
      <div style={{ padding: "0 28px 34px" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 26 }}>
          {SLIDES.map((_, idx) => (
            <div key={idx} style={{ height: 7, borderRadius: 4, transition: "all .3s",
              width: idx === i ? 22 : 7, background: idx === i ? P : "#E0DAD0" }} />
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={next}
          style={{ width: "100%", height: 54, borderRadius: 15, border: "none", cursor: "pointer",
            background: DARK, color: "white", fontSize: 16, fontWeight: 700, fontFamily: FONT,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {i < SLIDES.length - 1 ? "Suivant" : "Commencer"}
          <ArrowRight size={18} />
        </motion.button>
      </div>
    </div>
  );
}
