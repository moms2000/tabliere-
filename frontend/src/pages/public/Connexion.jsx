import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { UtensilsCrossed, Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const G = "#1D9E75";

export default function Connexion() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(true);   // "Rester connecté" coché par défaut
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
    <div style={{
      minHeight: "100vh", background: "#f7f7f5",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "60px 24px",
    }}>

      {/* Back */}
      <div style={{ position: "fixed", top: 20, left: 24 }}>
        <button onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", cursor: "pointer", fontSize: 13, color: "#888" }}>
          <ArrowLeft size={15} /> Retour
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: "white", borderRadius: 16, padding: "36px 40px",
          border: "0.5px solid #eee", width: "100%", maxWidth: 420,
          boxShadow: "0 4px 24px rgba(0,0,0,.07)",
        }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: G,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UtensilsCrossed size={17} color="white" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 600, color: G }}>TablièreCI</span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Connexion</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Bon retour sur TablièreCI</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2",
              border: "0.5px solid #FECACA", borderRadius: 8, padding: "10px 13px" }}>
              <AlertCircle size={14} color="#DC2626" />
              <span style={{ fontSize: 13, color: "#DC2626" }}>{error}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label style={labelStyle}>Adresse e-mail</label>
            <div style={inputWrap}>
              <Mail size={15} color="#bbb" />
              <input value={email} onChange={e => setEmail(e.target.value)}
                type="email" placeholder="vous@exemple.com" required
                style={inputStyle} />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label style={labelStyle}>Mot de passe</label>
            <div style={inputWrap}>
              <Lock size={15} color="#bbb" />
              <input value={password} onChange={e => setPassword(e.target.value)}
                type={showPw ? "text" : "password"} placeholder="••••••••" required
                style={inputStyle} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ background: "transparent", border: "none",
                  cursor: "pointer", color: "#bbb", display: "flex", padding: 0 }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div style={{ textAlign: "right", marginTop: 6 }}>
              <span style={{ fontSize: 12, color: G, cursor: "pointer" }}>
                Mot de passe oublié ?
              </span>
            </div>
          </div>

          {/* Rester connecté */}
          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            cursor: "pointer", userSelect: "none",
          }}>
            <div onClick={() => setRemember(p => !p)}
              style={{
                width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                background: remember ? G : "#ddd",
                position: "relative", transition: "background 0.2s", cursor: "pointer",
              }}>
              <div style={{
                position: "absolute", top: 2,
                left: remember ? 18 : 2,
                width: 16, height: 16, borderRadius: "50%",
                background: "white", transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,.2)",
              }} />
            </div>
            <span style={{ fontSize: 13, color: "#555" }}>Rester connecté</span>
            <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>
              {remember ? "30 jours" : "Cette session"}
            </span>
          </label>

          <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
            style={{
              background: loading ? "#a0cfbe" : G, color: "white", border: "none",
              borderRadius: 9, padding: "12px 0", fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
              transition: "background 0.2s",
            }}>
            {loading ? "Connexion en cours..." : "Se connecter"}
          </motion.button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#888", marginTop: 20 }}>
          Pas encore de compte ?{" "}
          <Link to="/inscription" style={{ color: G, fontWeight: 500, textDecoration: "none" }}>
            S'inscrire
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

const labelStyle = {
  fontSize: 12, fontWeight: 500, color: "#555",
  display: "block", marginBottom: 6,
};
const inputWrap = {
  display: "flex", alignItems: "center", gap: 10,
  border: "0.5px solid #ddd", borderRadius: 9, padding: "10px 13px",
};
const inputStyle = {
  border: "none", background: "transparent", fontSize: 13,
  outline: "none", flex: 1, color: "#333",
};
