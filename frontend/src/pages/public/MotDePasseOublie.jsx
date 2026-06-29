import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import api from "../../services/api.js";

const P = "#E8A045"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const BORDER = "#E4DFD8"; const BG = "#F8F5EF";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

export default function MotDePasseOublie() {
  const navigate = useNavigate();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "Une erreur est survenue. Réessayez.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: "white", borderRadius: 16, padding: "40px 36px",
          maxWidth: 420, width: "100%", boxShadow: "0 8px 40px rgba(30,46,40,.09)",
          border: `0.5px solid ${BORDER}` }}>

        <button onClick={() => navigate("/connexion")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none",
            border: "none", cursor: "pointer", color: MUTED, fontSize: 13, marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={14} /> Retour à la connexion
        </button>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#E1F5EE",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle size={30} color="#1D9E75" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: DARK, marginBottom: 10 }}>E-mail envoyé !</h2>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Si <strong style={{ color: DARK }}>{email}</strong> est associé à un compte,
              vous recevrez un lien de réinitialisation dans quelques minutes.<br /><br />
              Vérifiez aussi vos spams.
            </p>
            <button onClick={() => navigate("/connexion")}
              style={{ background: P, color: "#1A1000", border: "none", borderRadius: 9,
                padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
              Retour à la connexion
            </button>
          </div>
        ) : (
          <>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FEF6EC",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <Mail size={24} color={P} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 500, color: DARK, marginBottom: 8 }}>
              Mot de passe oublié ?
            </h2>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.65, marginBottom: 28 }}>
              Entrez votre adresse e-mail. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && (
                <div style={{ background: "#FAECE7", border: "0.5px solid #FECACA",
                  borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#993C1D" }}>
                  {error}
                </div>
              )}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700,
                  color: MUTED, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 }}>
                  Adresse e-mail
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10,
                  border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", background: BG }}>
                  <Mail size={14} color={MUTED} />
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    type="email" placeholder="vous@exemple.com" required
                    style={{ border: "none", background: "transparent", fontSize: 14,
                      outline: "none", flex: 1, color: DARK, fontFamily: FONT }} />
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                style={{ background: loading ? P + "99" : P, color: "#1A1000", border: "none",
                  borderRadius: 9, padding: "13px 0", fontSize: 14, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT }}>
                {loading ? "Envoi en cours…" : "Envoyer le lien"}
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
