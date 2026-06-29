/**
 * ConnexionAdmin — Accès secret admin
 * Route : /connexion/admin (non listée publiquement)
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff, Shield } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const P    = "#E8A045";
const DARK = "#1E2E28";
const BG   = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

export default function ConnexionAdmin() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password, true);
      if (user.role !== "admin") {
        await logout();
        setError("Accès refusé. Cette interface est réservée aux administrateurs TablièreCI.");
        setLoading(false);
        return;
      }
      navigate("/admin", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 400) setError("Identifiants incorrects.");
      else if (status === 403) setError("Compte suspendu.");
      else setError("Erreur de connexion. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: DARK, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>

      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        style={{ background: "white", borderRadius: 18, padding: "40px 36px",
          maxWidth: 400, width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,.35)" }}>

        {/* Logo + titre */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: DARK,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px" }}>
            <Shield size={28} color={P} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: P,
            letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>
            TablièreCI
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: DARK, margin: 0 }}>
            Espace Administration
          </h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
            Accès restreint — personnel autorisé uniquement
          </p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#FAECE7", border: "0.5px solid #FECACA",
              borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#993C1D",
              marginBottom: 20 }}>
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUTED,
              textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 }}>
              Adresse e-mail
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10,
              border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", background: BG }}>
              <Mail size={14} color={MUTED} />
              <input value={email} onChange={e => setEmail(e.target.value)}
                type="email" placeholder="admin@tabliereci.net" required
                autoComplete="username"
                style={{ border: "none", background: "transparent", fontSize: 14,
                  outline: "none", flex: 1, color: DARK, fontFamily: FONT }} />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUTED,
              textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 }}>
              Mot de passe
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10,
              border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", background: BG }}>
              <Lock size={14} color={MUTED} />
              <input value={password} onChange={e => setPassword(e.target.value)}
                type={showPw ? "text" : "password"} placeholder="••••••••" required
                autoComplete="current-password"
                style={{ border: "none", background: "transparent", fontSize: 14,
                  outline: "none", flex: 1, color: DARK, fontFamily: FONT }} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
            style={{ background: loading ? DARK + "88" : DARK, color: P,
              border: "none", borderRadius: 9, padding: "14px 0", fontSize: 14,
              fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: FONT, marginTop: 4, letterSpacing: "0.5px" }}>
            {loading ? "Authentification…" : "Accéder au tableau de bord"}
          </motion.button>
        </form>

        {/* Discret */}
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 10,
          color: "rgba(155,142,127,.5)", letterSpacing: "1px", textTransform: "uppercase" }}>
          Connexion sécurisée · TablièreCI ©2026
        </div>
      </motion.div>
    </div>
  );
}
