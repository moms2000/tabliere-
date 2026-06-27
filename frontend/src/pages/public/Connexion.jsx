import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

// ── Design tokens ─────────────────────────────────────────────────────────────
const P      = "#E8A045";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";

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

export default function Connexion() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const from = location.state?.from?.pathname || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password, remember);
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === "admin") {
        navigate("/admin",      { replace: true });
      } else if (user.role === "restaurateur") {
        navigate("/restaurant", { replace: true });
      } else {
        navigate("/",           { replace: true });
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 400) {
        setError("Email ou mot de passe incorrect.");
      } else if (status === 403) {
        setError("Votre compte a été suspendu. Contactez le support.");
      } else {
        setError(err.response?.data?.message || "Une erreur est survenue. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px 16px",
      fontFamily: "'Inter', sans-serif" }}>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: "100%", maxWidth: 860, display: "grid",
          gridTemplateColumns: "1fr 1fr", borderRadius: 16, overflow: "hidden",
          border: `0.5px solid ${BORDER}`,
          boxShadow: "0 8px 40px rgba(30,46,40,.09)" }}>

        {/* ── Panneau gauche sombre ─────────────────────────────────────────── */}
        <div style={{ background: DARK, padding: "44px 36px",
          display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 52 }}>
              <Logo size={30} />
              <span style={{ fontSize: 16, fontWeight: 400, color: "#EAE0CC", letterSpacing: "-0.3px" }}>
                Tablière<span style={{ color: P, fontWeight: 500 }}>CI</span>
              </span>
            </div>
            <div style={{ fontSize: 9, letterSpacing: "2.5px", textTransform: "uppercase",
              color: P, opacity: 0.8, marginBottom: 16 }}>
              Abidjan · Côte d'Ivoire
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 300, color: "#EAE0CC",
              lineHeight: 1.2, letterSpacing: "-0.5px", marginBottom: 14 }}>
              Bon retour<br />parmi nous.
            </h1>
            <p style={{ fontSize: 13, color: "rgba(180,165,130,0.5)", lineHeight: 1.7, maxWidth: 220 }}>
              Les meilleures tables d'Abidjan vous attendent.
            </p>
          </div>
          <div style={{ display: "flex", gap: 28 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 300, color: P, lineHeight: 1 }}>142</div>
              <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
                color: "rgba(180,165,130,0.3)", marginTop: 4 }}>Tables libres</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 300, color: S, lineHeight: 1 }}>4.8</div>
              <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
                color: "rgba(180,165,130,0.3)", marginTop: 4 }}>Note moyenne</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 300, color: "#EAE0CC", lineHeight: 1 }}>34</div>
              <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
                color: "rgba(180,165,130,0.3)", marginTop: 4 }}>Restaurants</div>
            </div>
          </div>
        </div>

        {/* ── Panneau droit — formulaire ────────────────────────────────────── */}
        <div style={{ background: "#FAFAF6", padding: "44px 36px",
          display: "flex", flexDirection: "column", justifyContent: "center" }}>

          <button onClick={() => navigate("/")}
            style={{ alignSelf: "flex-start", background: "transparent", border: "none",
              cursor: "pointer", fontSize: 12, color: MUTED, marginBottom: 28,
              display: "flex", alignItems: "center", gap: 5, padding: 0 }}>
            ← Retour à l'accueil
          </button>

          <div style={{ fontSize: 20, fontWeight: 500, color: DARK, marginBottom: 4 }}>Connexion</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 28 }}>Accédez à votre compte</div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                background: "#FEF2F2", border: "0.5px solid #FECACA",
                borderRadius: 8, padding: "10px 13px" }}>
                <AlertCircle size={14} color="#DC2626" />
                <span style={{ fontSize: 13, color: "#DC2626" }}>{error}</span>
              </div>
            )}

            <div>
              <label style={labelSt}>Adresse e-mail</label>
              <div style={wrapSt}>
                <Mail size={14} color={MUTED} />
                <input value={email} onChange={e => setEmail(e.target.value)}
                  type="email" placeholder="vous@exemple.com" required style={inpSt} />
              </div>
            </div>

            <div>
              <label style={labelSt}>Mot de passe</label>
              <div style={wrapSt}>
                <Lock size={14} color={MUTED} />
                <input value={password} onChange={e => setPassword(e.target.value)}
                  type={showPw ? "text" : "password"} placeholder="••••••••" required style={inpSt} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ background: "transparent", border: "none",
                    cursor: "pointer", color: MUTED, display: "flex", padding: 0 }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div style={{ textAlign: "right", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: P, cursor: "pointer" }}>Mot de passe oublié ?</span>
              </div>
            </div>

            {/* Toggle rester connecté */}
            <label style={{ display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", userSelect: "none" }}>
              <div onClick={() => setRemember(p => !p)}
                style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                  background: remember ? P : BORDER, position: "relative",
                  transition: "background 0.2s", cursor: "pointer" }}>
                <div style={{ position: "absolute", top: 2,
                  left: remember ? 18 : 2, width: 16, height: 16, borderRadius: "50%",
                  background: "white", transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,.15)" }} />
              </div>
              <span style={{ fontSize: 12, color: DARK }}>Rester connecté</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto" }}>
                {remember ? "30 jours" : "Cette session"}
              </span>
            </label>

            <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
              style={{ background: loading ? "#F0C98A" : P, color: "#1A1000",
                border: "none", borderRadius: 9, padding: "13px 0",
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4, transition: "background 0.2s", fontFamily: "inherit" }}>
              {loading ? "Connexion en cours…" : "Se connecter"}
            </motion.button>
          </form>

          <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 20 }}>
            Pas encore de compte ?{" "}
            <Link to="/inscription" style={{ color: P, fontWeight: 500, textDecoration: "none" }}>
              S'inscrire
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

const labelSt = {
  fontSize: 11, fontWeight: 500, color: "#6A7A72", display: "block", marginBottom: 6,
};
const wrapSt = {
  display: "flex", alignItems: "center", gap: 10,
  border: `0.5px solid #E4DFD8`, borderRadius: 9, padding: "11px 14px", background: "#F8F5EF",
};
const inpSt = {
  border: "none", background: "transparent", fontSize: 13,
  outline: "none", flex: 1, color: "#1E2E28", fontFamily: "inherit",
};
