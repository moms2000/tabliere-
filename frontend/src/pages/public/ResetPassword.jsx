import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import api from "../../services/api.js";

const P = "#E8A045"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const BORDER = "#E4DFD8"; const BG = "#F8F5EF";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== password2) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Minimum 8 caractères."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "Lien invalide ou expiré. Refaites la demande.");
    } finally { setLoading(false); }
  };

  if (!token) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: FONT, color: MUTED, fontSize: 14 }}>
      Lien invalide. <button onClick={() => navigate("/mot-de-passe-oublie")}
        style={{ background: "none", border: "none", color: P, cursor: "pointer", marginLeft: 4 }}>
        Refaire une demande
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: "white", borderRadius: 16, padding: "40px 36px",
          maxWidth: 420, width: "100%", boxShadow: "0 8px 40px rgba(30,46,40,.09)",
          border: `0.5px solid ${BORDER}` }}>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.4 }}
              style={{ width: 60, height: 60, borderRadius: "50%", background: "#E1F5EE",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle size={30} color="#1D9E75" />
            </motion.div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: DARK, marginBottom: 10 }}>
              Mot de passe mis à jour !
            </h2>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>
              Votre mot de passe a été modifié avec succès.
            </p>
            <button onClick={() => navigate("/connexion")}
              style={{ background: P, color: "#1A1000", border: "none", borderRadius: 9,
                padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
              Se connecter
            </button>
          </div>
        ) : (
          <>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FEF6EC",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <Lock size={24} color={P} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 500, color: DARK, marginBottom: 8 }}>
              Nouveau mot de passe
            </h2>
            <p style={{ color: MUTED, fontSize: 14, marginBottom: 28 }}>
              Choisissez un mot de passe sécurisé (min. 8 caractères).
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {error && (
                <div style={{ background: "#FAECE7", borderRadius: 8, padding: "10px 14px",
                  fontSize: 13, color: "#993C1D" }}>{error}</div>
              )}

              {[
                { label: "Nouveau mot de passe", value: password, set: setPassword, ph: "••••••••" },
                { label: "Confirmer le mot de passe", value: password2, set: setPassword2, ph: "••••••••" },
              ].map(({ label, value, set, ph }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700,
                    color: MUTED, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 }}>
                    {label}
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10,
                    border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", background: BG }}>
                    <Lock size={14} color={MUTED} />
                    <input value={value} onChange={e => set(e.target.value)}
                      type={showPw ? "text" : "password"} placeholder={ph} required
                      style={{ border: "none", background: "transparent", fontSize: 14,
                        outline: "none", flex: 1, color: DARK, fontFamily: FONT }} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}>
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}

              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                style={{ background: loading ? P + "99" : P, color: "#1A1000", border: "none",
                  borderRadius: 9, padding: "13px 0", fontSize: 14, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT, marginTop: 4 }}>
                {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
