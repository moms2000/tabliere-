import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, ArrowLeft, UtensilsCrossed } from "lucide-react";

const P    = "#E8A045";
const PL   = "#FEF6EC";
const DARK = "#1E2E28";
const MUTED = "#9BA89F";
const FONT = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#F8F5EF", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT, padding: "20px", textAlign: "center" }}>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}>

        {/* Icône */}
        <div style={{ width: 72, height: 72, borderRadius: 16, background: PL,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px" }}>
          <UtensilsCrossed size={34} color={P} />
        </div>

        {/* Code */}
        <div style={{ fontSize: 80, fontWeight: 800, color: P,
          lineHeight: 1, marginBottom: 8, letterSpacing: "-2px" }}>
          404
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: DARK, marginBottom: 10 }}>
          Table introuvable
        </h1>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65,
          maxWidth: 340, margin: "0 auto 32px" }}>
          La page que vous cherchez n'existe pas ou a été déplacée.
          Retournez à l'accueil pour trouver votre restaurant.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => navigate(-1)}
            style={{ display: "flex", alignItems: "center", gap: 8,
              border: `0.5px solid #E4DFD8`, borderRadius: 10, padding: "11px 20px",
              background: "white", color: MUTED, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: FONT }}>
            <ArrowLeft size={15} /> Retour
          </button>
          <button onClick={() => navigate("/")}
            style={{ display: "flex", alignItems: "center", gap: 8,
              border: "none", borderRadius: 10, padding: "11px 20px",
              background: P, color: "white", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: FONT }}>
            <Home size={15} /> Accueil
          </button>
        </div>
      </motion.div>
    </div>
  );
}
