import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Gift, Sparkles, Star, RotateCcw } from "lucide-react";

const P = "#E8A045"; const GOLD = "#F0A81E"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

// Cinématique claire et festive : décompte 3-2-1 puis annonce gagné / perdu,
// fond lumineux, aurores pastel, confettis, vraies icônes (pas d'emojis).
// result = { won, reward?, code? } ; onDone() quand l'utilisateur continue.
export default function GameReveal({ result = {}, onDone }) {
  const [phase, setPhase] = useState("count"); // count | reveal
  const [n, setN] = useState(3);
  const won = !!result.won;

  useEffect(() => {
    if (phase !== "count") return;
    if (n <= 0) { const t = setTimeout(() => setPhase("reveal"), 380); return () => clearTimeout(t); }
    const t = setTimeout(() => setN(x => x - 1), 950);
    return () => clearTimeout(t);
  }, [n, phase]);

  const bg = won
    ? "radial-gradient(circle at 50% 28%, #FFF6E2 0%, #FDECCB 42%, #F8F5EF 100%)"
    : "radial-gradient(circle at 50% 28%, #F1ECFF 0%, #F5F0FB 42%, #F8F5EF 100%)";
  const cols = won ? ["#FFD37A", "#FFB27A", "#FF9EC4"] : ["#B9A9FF", "#9AB8FF", "#C7B0FF"];
  const accent = won ? GOLD : "#7A5AF8";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: bg, overflow: "hidden", fontFamily: FONT,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        @keyframes gr-d1{0%{transform:translate(-12%,-8%) scale(1)}50%{transform:translate(14%,10%) scale(1.35)}100%{transform:translate(-12%,-8%) scale(1)}}
        @keyframes gr-d2{0%{transform:translate(12%,18%) scale(1.1)}50%{transform:translate(-16%,-12%) scale(1.45)}100%{transform:translate(12%,18%) scale(1.1)}}
        @keyframes gr-d3{0%{transform:translate(18%,-16%) scale(1)}50%{transform:translate(-12%,14%) scale(1.25)}100%{transform:translate(18%,-16%) scale(1)}}
        @keyframes gr-spin{to{transform:rotate(360deg)}}
        @keyframes gr-shine{0%{transform:translateX(-140%) skewX(-18deg)}55%,100%{transform:translateX(320%) skewX(-18deg)}}
        @keyframes gr-pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.75;transform:scale(1.1)}}
      `}</style>

      {/* Aurores pastel */}
      <Blob color={cols[0]} anim="gr-d1 9s ease-in-out infinite"  pos={{ top: "-18%", left: "-14%" }} />
      <Blob color={cols[1]} anim="gr-d2 11s ease-in-out infinite" pos={{ top: "42%", left: "48%" }} />
      <Blob color={cols[2]} anim="gr-d3 13s ease-in-out infinite" pos={{ top: "50%", left: "-18%" }} />

      <AnimatePresence>
        {phase === "count"
          ? <Countdown key="count" n={n} accent={accent} />
          : won ? <Win key="win" result={result} onDone={onDone} />
                : <Lose key="lose" onDone={onDone} />}
      </AnimatePresence>
    </div>
  );
}

function Blob({ color, anim, pos }) {
  return (
    <div style={{ position: "absolute", width: "60vmin", height: "60vmin", ...pos,
      background: `radial-gradient(circle, ${color}, transparent 60%)`, filter: "blur(50px)",
      opacity: 0.6, animation: anim, pointerEvents: "none" }} />
  );
}

function Countdown({ n, accent }) {
  return (
    <motion.div key="cd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.15 }}
      transition={{ duration: 0.35 }}
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
      <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}44, transparent 66%)`, filter: "blur(22px)", animation: "gr-pulse 1.5s ease-in-out infinite" }} />
      <motion.div key={`ring${n}`} initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 3.2, opacity: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{ position: "absolute", width: 170, height: 170, borderRadius: "50%", border: `2.5px solid ${accent}` }} />
      <AnimatePresence>
        <motion.div key={n}
          initial={{ scale: 2.7, opacity: 0, filter: "blur(10px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          exit={{ scale: 0.3, opacity: 0, filter: "blur(12px)" }}
          transition={{ type: "spring", stiffness: 200, damping: 17 }}
          style={{ position: "absolute", fontSize: "clamp(130px,42vw,210px)", fontWeight: 900, color: DARK,
            lineHeight: 1, textShadow: `0 8px 40px ${accent}88` }}>
          {n}
        </motion.div>
      </AnimatePresence>
      <div style={{ position: "absolute", bottom: -96, fontSize: 12.5, letterSpacing: "5px", color: MUTED, textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: 600 }}>
        Tirage en cours
      </div>
    </motion.div>
  );
}

function Win({ result, onDone }) {
  return (
    <motion.div key="w" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
      style={{ position: "relative", textAlign: "center", maxWidth: 430, zIndex: 3 }}>
      <motion.div initial={{ scale: 0, opacity: 0.7 }} animate={{ scale: 7, opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }}
        style={{ position: "absolute", top: "16%", left: "50%", width: 180, height: 180, marginLeft: -90, borderRadius: "50%",
          background: `radial-gradient(circle,${GOLD}cc,transparent 60%)`, pointerEvents: "none" }} />
      <Confetti />

      {/* médaillon + rayons tournants */}
      <div style={{ position: "relative", width: 150, height: 150, margin: "0 auto 26px" }}>
        <div style={{ position: "absolute", inset: -36, borderRadius: "50%", animation: "gr-spin 7s linear infinite",
          background: `conic-gradient(from 0deg, transparent, ${GOLD}, transparent 22%, ${GOLD} 50%, transparent 55%, ${GOLD} 78%, transparent)`,
          opacity: 0.4, filter: "blur(2px)" }} />
        <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: `radial-gradient(circle,${GOLD}66,transparent 68%)`, filter: "blur(12px)", animation: "gr-pulse 2s ease-in-out infinite" }} />
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          style={{ position: "absolute", inset: 20, borderRadius: "50%", background: "linear-gradient(140deg,#FFE070,#F0A81E)",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 18px 44px ${GOLD}66` }}>
          <Trophy size={52} color="#7A4B00" strokeWidth={2.3} />
        </motion.div>
      </div>

      <div style={{ fontSize: 13, letterSpacing: "4px", textTransform: "uppercase", fontWeight: 800, color: P, marginBottom: 8 }}>Félicitations</div>
      <h1 style={{ position: "relative", display: "inline-block", fontSize: "clamp(30px,9vw,44px)", fontWeight: 900, color: DARK, margin: "0 0 12px", lineHeight: 1.05, overflow: "hidden" }}>
        Vous avez gagné !
        <span style={{ position: "absolute", top: 0, left: 0, width: "45%", height: "100%",
          background: "linear-gradient(100deg,transparent,rgba(255,255,255,.85),transparent)", animation: "gr-shine 2.6s ease-in-out infinite" }} />
      </h1>
      <div style={{ fontSize: 16, color: "#5A6B62", margin: "0 0 20px", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600 }}>
        <Sparkles size={16} color={P} /> {result.reward || "Un cadeau"}
      </div>
      {result.code && (
        <div style={{ background: "white", border: `1.5px solid ${GOLD}`, borderRadius: 16, padding: 16, marginBottom: 24,
          boxShadow: `0 12px 40px ${GOLD}44` }}>
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
    <motion.div key="l" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}
      style={{ textAlign: "center", maxWidth: 410, zIndex: 3 }}>
      <div style={{ position: "relative", width: 132, height: 132, margin: "0 auto 24px" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle,#8B5CF644,transparent 70%)", filter: "blur(14px)", animation: "gr-pulse 2.4s ease-in-out infinite" }} />
        <motion.div animate={{ rotate: [0, 12, -12, 0] }} transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }}
          style={{ position: "absolute", inset: 22, borderRadius: "50%", background: "white", border: "1.5px solid #E4DEFB",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 34px rgba(122,90,248,.2)" }}>
          <Star size={44} color="#7A5AF8" strokeWidth={2} />
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

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#F0A81E", "#E8A045", "#3D6B55", "#FF7A59", "#4F9DDE", "#E85AA0"];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 0.7, dur: 2.2 + Math.random() * 1.8,
      size: 7 + Math.random() * 9, color: colors[i % colors.length], rot: Math.random() * 360,
    }));
  }, []);
  return (
    <div style={{ position: "absolute", inset: "-40% 0 0 0", pointerEvents: "none", overflow: "hidden", zIndex: 1 }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          initial={{ y: "-10%", rotate: p.rot, opacity: 1 }}
          animate={{ y: "260%", rotate: p.rot + 400, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", left: `${p.left}%`, top: 0, width: p.size, height: p.size * 1.5, background: p.color, borderRadius: 2 }} />
      ))}
    </div>
  );
}

const cta = (bg, color) => ({
  display: "inline-flex", alignItems: "center", gap: 8, background: bg, color, border: "none",
  borderRadius: 30, padding: "14px 30px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
  boxShadow: "0 10px 30px rgba(30,46,40,.14)",
});
