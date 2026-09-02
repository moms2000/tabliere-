import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, PartyPopper, RefreshCw } from "lucide-react";

const P = "#E8A045"; const DARK = "#1E2E28"; const GOLD = "#F5C400";
const FONT = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

// Cinématique de résultat de jeu : décompte 3-2-1 puis annonce gagné / perdu.
// result = { won, reward?, code? }. onDone() appelé quand l'utilisateur continue.
export default function GameReveal({ result = {}, onDone }) {
  const [phase, setPhase] = useState("count"); // count | reveal
  const [n, setN] = useState(3);

  useEffect(() => {
    if (phase !== "count") return;
    if (n <= 0) { setPhase("reveal"); return; }
    const t = setTimeout(() => setN(x => x - 1), 850);
    return () => clearTimeout(t);
  }, [n, phase]);

  const won = !!result.won;
  const bg = won
    ? "radial-gradient(circle at 50% 30%, #2E7D5B 0%, #1E2E28 70%)"
    : "radial-gradient(circle at 50% 30%, #3A4A42 0%, #1E2E28 70%)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: bg, fontFamily: FONT,
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 24 }}>

      {won && phase === "reveal" && <Confetti />}

      <AnimatePresence mode="wait">
        {phase === "count" ? (
          <motion.div key={`c${n}`} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ textAlign: "center" }}>
            <div style={{ fontSize: 130, fontWeight: 900, color: n === 0 ? P : "#EAE0CC", lineHeight: 1 }}>
              {n === 0 ? "🎲" : n}
            </div>
            <div style={{ fontSize: 15, color: "rgba(234,224,204,.6)", letterSpacing: "3px", textTransform: "uppercase", marginTop: 10 }}>
              Tirage en cours
            </div>
          </motion.div>
        ) : won ? (
          <motion.div key="win" initial={{ scale: 0.6, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            style={{ textAlign: "center", maxWidth: 420, position: "relative", zIndex: 2 }}>
            <motion.div animate={{ rotate: [0, -8, 8, -8, 0], y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}
              style={{ width: 96, height: 96, borderRadius: "50%", background: "linear-gradient(140deg,#F5C400,#E8A045)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px",
                boxShadow: "0 12px 40px rgba(245,196,0,.4)" }}>
              <PartyPopper size={46} color="#1A1000" />
            </motion.div>
            <div style={{ fontSize: 14, color: GOLD, letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
              Félicitations
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 900, color: "white", margin: "0 0 10px", lineHeight: 1.1 }}>
              Vous avez gagné !
            </h1>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,.85)", margin: "0 0 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Sparkles size={16} color={GOLD} /> {result.reward || "Un cadeau"}
            </p>
            {result.code && (
              <div style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(245,196,0,.4)", borderRadius: 14, padding: "16px", marginBottom: 22 }}>
                <div style={{ fontSize: 11, color: "rgba(234,224,204,.6)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Votre code</div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "3px", color: GOLD, fontFamily: "monospace" }}>{result.code}</div>
              </div>
            )}
            <button onClick={onDone}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: P, color: "#1A1000", border: "none",
                borderRadius: 30, padding: "14px 30px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
              <Gift size={18} /> Voir mon cadeau
            </button>
          </motion.div>
        ) : (
          <motion.div key="lose" initial={{ scale: 0.7, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 170, damping: 16 }}
            style={{ textAlign: "center", maxWidth: 400 }}>
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
              style={{ width: 92, height: 92, borderRadius: "50%", background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(234,224,204,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px" }}>
              <span style={{ fontSize: 46 }}>🍀</span>
            </motion.div>
            <div style={{ fontSize: 14, color: "rgba(234,224,204,.55)", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
              Presque !
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "white", margin: "0 0 10px", lineHeight: 1.15 }}>
              Pas de chance cette fois
            </h1>
            <p style={{ fontSize: 15.5, color: "rgba(255,255,255,.8)", margin: "0 0 24px", lineHeight: 1.6 }}>
              Pas grave ! Votre compte est créé et vous pouvez retenter votre chance aux prochains jeux TablièreCI.
            </p>
            <button onClick={onDone}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", color: DARK, border: "none",
                borderRadius: 30, padding: "14px 30px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
              <RefreshCw size={17} /> Continuer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Confettis : ~40 pastilles colorées qui tombent.
function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#F5C400", "#E8A045", "#3D6B55", "#EAE0CC", "#FF7A59", "#4F9DDE"];
    return Array.from({ length: 44 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 2 + Math.random() * 1.8,
      size: 7 + Math.random() * 8,
      color: colors[i % colors.length],
      rot: Math.random() * 360,
    }));
  }, []);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 1 }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          initial={{ y: "-12%", x: 0, rotate: p.rot, opacity: 1 }}
          animate={{ y: "112%", rotate: p.rot + 360, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", left: `${p.left}%`, top: 0, width: p.size, height: p.size * 1.4,
            background: p.color, borderRadius: 2 }} />
      ))}
    </div>
  );
}
