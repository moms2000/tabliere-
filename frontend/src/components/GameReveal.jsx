import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, RotateCcw } from "lucide-react";

const P = "#E8A045"; const GOLD = "#F0A81E"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

// Cinématique de marque : le logo « T » de TablièreCI se CONSTRUIT pièce par pièce
// (carré, barres, courbe, éclat), rayons de lumière + particules dorées, puis
// révélation gagné / perdu. Fond clair et festif, vraies formes (pas d'emojis).
export default function GameReveal({ result = {}, onDone }) {
  const [phase, setPhase] = useState("build"); // build | reveal
  const won = !!result.won;

  useEffect(() => {
    const t = setTimeout(() => setPhase("reveal"), 2900); // durée de la construction
    return () => clearTimeout(t);
  }, []);

  const bg = won
    ? "radial-gradient(circle at 50% 22%, #FFF7E6 0%, #FDECCB 44%, #F6F1E8 100%)"
    : "radial-gradient(circle at 50% 22%, #F1ECFF 0%, #F4EFFB 44%, #F6F2EC 100%)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: bg, overflow: "hidden", fontFamily: FONT,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        @keyframes gr-spin{to{transform:rotate(360deg)}}
        @keyframes gr-rise{0%{transform:translateY(0);opacity:0}15%{opacity:.9}100%{transform:translateY(-60vh);opacity:0}}
        @keyframes gr-pulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.7;transform:scale(1.12)}}
      `}</style>

      {/* Rayons de lumière (sunburst tournant, subtil) */}
      <div style={{ position: "absolute", top: "-30%", left: "50%", width: "120vmax", height: "120vmax",
        transform: "translateX(-50%)", opacity: won ? 0.5 : 0.32, animation: "gr-spin 26s linear infinite",
        background: `repeating-conic-gradient(from 0deg at 50% 50%, ${won ? "#FFE0A6" : "#D8CCFF"} 0deg 6deg, transparent 6deg 18deg)`,
        maskImage: "radial-gradient(circle at 50% 50%, black 0%, transparent 60%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 0%, transparent 60%)", pointerEvents: "none" }} />
      <Particles color={won ? "#F0A81E" : "#9A85FF"} />

      <AnimatePresence>
        {phase === "build"
          ? <Build key="build" won={won} />
          : won ? <Win key="win" result={result} onDone={onDone} />
                : <Lose key="lose" onDone={onDone} />}
      </AnimatePresence>
    </div>
  );
}

// ── Le logo T qui se construit ───────────────────────────────────────────────
function BrandT({ size = 210, build = false }) {
  const rx = (9 / 40) * size;
  const sq   = build ? { initial: { scale: 0, rotate: -28, opacity: 0 }, animate: { scale: 1, rotate: 0, opacity: 1 }, transition: { type: "spring", stiffness: 130, damping: 12, delay: 0.1 } } : {};
  const hbar = build ? { initial: { scaleX: 0, opacity: 0 }, animate: { scaleX: 1, opacity: 1 }, transition: { duration: 0.42, delay: 0.75, ease: [0.34, 1.56, 0.64, 1] } } : {};
  const vbar = build ? { initial: { scaleY: 0, opacity: 0 }, animate: { scaleY: 1, opacity: 1 }, transition: { duration: 0.42, delay: 1.0, ease: [0.34, 1.56, 0.64, 1] } } : {};
  const curve = build ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 0.6, delay: 1.3 } } : {};
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div style={{ position: "absolute", inset: -size * 0.16, borderRadius: "50%", background: `radial-gradient(circle,${P}66,transparent 66%)`, filter: "blur(26px)", animation: "gr-pulse 2.2s ease-in-out infinite" }} />
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ position: "relative", filter: "drop-shadow(0 16px 34px rgba(232,160,69,.5))" }}>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F7BE60" /><stop offset="1" stopColor="#E29327" />
          </linearGradient>
        </defs>
        <motion.rect width="40" height="40" rx="9" fill="url(#tg)" {...sq} style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        <motion.rect x="9" y="12" width="22" height="2.6" rx="1.3" fill="white" {...hbar} style={{ transformBox: "fill-box", transformOrigin: "left center" }} />
        <motion.rect x="17" y="14.6" width="6" height="13" rx="1.5" fill="white" {...vbar} style={{ transformBox: "fill-box", transformOrigin: "top center" }} />
        <motion.path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5" stroke="rgba(255,255,255,.55)" strokeWidth="1.4" fill="none" strokeLinecap="round" {...curve} />
      </svg>
      {/* éclat qui balaie le logo (clippé au carré arrondi) */}
      {build && (
        <div style={{ position: "absolute", inset: 0, borderRadius: rx, overflow: "hidden", pointerEvents: "none" }}>
          <motion.div initial={{ x: "-160%", opacity: 0 }} animate={{ x: "180%", opacity: [0, 1, 0] }}
            transition={{ duration: 0.75, delay: 1.75, ease: "easeInOut" }}
            style={{ position: "absolute", top: 0, left: 0, width: "55%", height: "100%",
              background: "linear-gradient(100deg,transparent,rgba(255,255,255,.85),transparent)", transform: "skewX(-18deg)" }} />
        </div>
      )}
    </div>
  );
}

function Wordmark({ delay = 1.9 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }}
      style={{ marginTop: 26, fontSize: 30, fontWeight: 400, letterSpacing: "-0.5px", color: DARK }}>
      Tablière<span style={{ color: P, fontWeight: 700 }}>CI</span>
    </motion.div>
  );
}

function Build({ won }) {
  return (
    <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.12 }}
      transition={{ duration: 0.35 }}
      style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <BrandT size={210} build />
      <Wordmark />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3 }}
        style={{ marginTop: 8, fontSize: 12, letterSpacing: "4px", textTransform: "uppercase", color: MUTED, fontWeight: 600 }}>
        Tirage en cours
      </motion.div>
    </motion.div>
  );
}

function Win({ result, onDone }) {
  return (
    <motion.div key="w" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}
      style={{ position: "relative", textAlign: "center", maxWidth: 440, zIndex: 3 }}>
      <motion.div initial={{ scale: 0, opacity: 0.85 }} animate={{ scale: 8, opacity: 0 }} transition={{ duration: 0.95, ease: "easeOut" }}
        style={{ position: "absolute", top: "6%", left: "50%", width: 180, height: 180, marginLeft: -90, borderRadius: "50%",
          background: `radial-gradient(circle,${GOLD}dd,transparent 60%)`, pointerEvents: "none" }} />
      <Confetti />

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}>
          <BrandT size={120} />
        </motion.div>
      </div>

      <div style={{ fontSize: 13, letterSpacing: "4px", textTransform: "uppercase", fontWeight: 800, color: P, marginBottom: 8 }}>Félicitations</div>
      <h1 style={{ position: "relative", display: "inline-block", fontSize: "clamp(30px,9vw,44px)", fontWeight: 900, color: DARK, margin: "0 0 12px", lineHeight: 1.05, overflow: "hidden" }}>
        Vous avez gagné !
        <span style={{ position: "absolute", top: 0, left: 0, width: "45%", height: "100%",
          background: "linear-gradient(100deg,transparent,rgba(255,255,255,.9),transparent)",
          animation: "gr-shine 2.6s ease-in-out infinite" }} />
      </h1>
      <style>{`@keyframes gr-shine{0%{transform:translateX(-140%) skewX(-18deg)}55%,100%{transform:translateX(320%) skewX(-18deg)}}`}</style>
      <div style={{ fontSize: 16, color: "#5A6B62", margin: "0 0 20px", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600 }}>
        <Sparkles size={16} color={P} /> {result.reward || "Un cadeau"}
      </div>
      {result.code && (
        <div style={{ background: "white", border: `1.5px solid ${GOLD}`, borderRadius: 16, padding: 16, marginBottom: 24, boxShadow: `0 14px 42px ${GOLD}44` }}>
          <div style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: MUTED, marginBottom: 7 }}>Votre code</div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "4px", color: P, fontFamily: "monospace" }}>{result.code}</div>
        </div>
      )}
      <button onClick={onDone} style={cta(P, "#1A1000")}><Gift size={18} /> Voir mon cadeau</button>
    </motion.div>
  );
}

function Lose({ onDone }) {
  return (
    <motion.div key="l" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}
      style={{ textAlign: "center", maxWidth: 410, zIndex: 3 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22, opacity: 0.92 }}>
        <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}>
          <BrandT size={110} />
        </motion.div>
      </div>
      <div style={{ fontSize: 13, letterSpacing: "4px", textTransform: "uppercase", fontWeight: 800, color: "#7A5AF8", marginBottom: 8 }}>Presque !</div>
      <h1 style={{ fontSize: "clamp(26px,8vw,38px)", fontWeight: 900, color: DARK, margin: "0 0 12px", lineHeight: 1.15 }}>Pas de chance cette fois</h1>
      <p style={{ fontSize: 15.5, color: "#5A6B62", margin: "0 0 26px", lineHeight: 1.6 }}>
        Votre compte est bien créé. Retentez votre chance aux prochains jeux TablièreCI.
      </p>
      <button onClick={onDone} style={cta(DARK, "#fff")}><RotateCcw size={17} /> Continuer</button>
    </motion.div>
  );
}

function Particles({ color }) {
  const pcs = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 3, dur: 4 + Math.random() * 3, size: 4 + Math.random() * 6,
  })), []);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pcs.map(p => (
        <div key={p.id} style={{ position: "absolute", bottom: "-6%", left: `${p.left}%`, width: p.size, height: p.size,
          borderRadius: "50%", background: color, filter: "blur(0.5px)", opacity: 0,
          animation: `gr-rise ${p.dur}s linear ${p.delay}s infinite` }} />
      ))}
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#F0A81E", "#E8A045", "#3D6B55", "#FF7A59", "#4F9DDE", "#E85AA0"];
    return Array.from({ length: 54 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 0.7, dur: 2.2 + Math.random() * 1.8,
      size: 7 + Math.random() * 9, color: colors[i % colors.length], rot: Math.random() * 360,
    }));
  }, []);
  return (
    <div style={{ position: "absolute", inset: "-45% 0 0 0", pointerEvents: "none", overflow: "hidden", zIndex: 1 }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          initial={{ y: "-10%", rotate: p.rot, opacity: 1 }}
          animate={{ y: "280%", rotate: p.rot + 420, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", left: `${p.left}%`, top: 0, width: p.size, height: p.size * 1.5, background: p.color, borderRadius: 2 }} />
      ))}
    </div>
  );
}

const cta = (bg, color) => ({
  display: "inline-flex", alignItems: "center", gap: 8, background: bg, color, border: "none",
  borderRadius: 30, padding: "14px 30px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
  boxShadow: "0 12px 32px rgba(30,46,40,.16)",
});
