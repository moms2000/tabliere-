import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const P     = "#E8A045";
const DARK  = "#1E2E28";
const CREAM = "#F8F5EF";
const FONT  = "'Avenir Next','Avenir','Century Gothic',sans-serif";

/**
 * LogoSplash — écran de lancement : le logo TablièreCI se dessine (style OpenTable).
 * Affiché une fois par ouverture de l'app (chargement complet), puis se retire.
 */
export default function LogoSplash() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 3400);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: 3.4, times: [0, 0.82, 1] }}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: CREAM,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 22, fontFamily: FONT }}>

      {/* Marque animée */}
      <motion.svg width="120" height="120" viewBox="0 0 40 40"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 16 }}>
        {/* Fond orange arrondi */}
        <motion.rect width="40" height="40" rx="10" fill={P}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
        {/* Barre haute du T (se dessine de gauche à droite, lentement) */}
        <motion.rect x="9" y="12" width="22" height="2.6" rx="1.3" fill="white"
          style={{ transformOrigin: "9px 13px" }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, delay: 0.6, ease: "easeInOut" }} />
        {/* Tige du T (se dessine de haut en bas) */}
        <motion.rect x="17" y="14.5" width="6" height="13" rx="1.6" fill="white"
          style={{ transformOrigin: "20px 14.5px" }}
          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
          transition={{ duration: 0.9, delay: 1.35, ease: "easeInOut" }} />
        {/* Vague (se trace) */}
        <motion.path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
          stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" fill="none" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 2.05, ease: "easeInOut" }} />
      </motion.svg>

      {/* Nom */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 2.5 }}
        style={{ fontSize: 28, fontWeight: 700, color: DARK, letterSpacing: "-0.5px" }}>
        Tablière<span style={{ color: P }}>CI</span>
      </motion.div>

      {/* Fine barre de progression sous le nom */}
      <motion.div
        initial={{ width: 0, opacity: 0 }} animate={{ width: 100, opacity: 1 }}
        transition={{ duration: 2.6, delay: 0.6 }}
        style={{ height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${P}, ${P}55)` }} />
    </motion.div>
  );
}
