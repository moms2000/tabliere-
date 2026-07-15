import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import api from "../../services/api.js";
import { authService } from "../../services/auth.service.js";

const roleHome = (role) => role === "admin" ? "/admin" : role === "restaurateur" ? "/restaurant" : role === "organisateur" ? "/event" : "/";

const P = "#E8A045"; const S = "#3D6B55"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status,  setStatus]  = useState("loading"); // loading | success | error | already
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending,   setResending]   = useState(false);
  const [resent,      setResent]      = useState(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("Lien invalide ou manquant."); return; }
    authService.verifyEmail(token)
      .then(data => {
        if (data?.already_verified) { setStatus("already"); return; }
        setStatus("success");
        // Auto-connexion : le backend a renvoyé des tokens (déjà stockés par le service).
        if (data?.user) setTimeout(() => window.location.replace(roleHome(data.user.role)), 1400);
      })
      .catch(e => {
        setStatus("error");
        setMessage(e.response?.data?.message || "Lien invalide ou expiré.");
      });
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email: resendEmail });
      setResent(true);
    } catch (_) { setResent(true); } // toujours montrer succès (sécurité)
    setResending(false);
  };

  const icons = {
    loading: <Loader2 size={48} color={P} style={{ animation: "spin 1s linear infinite" }} />,
    success: <CheckCircle size={48} color={S} />,
    already: <CheckCircle size={48} color={S} />,
    error:   <XCircle size={48} color="#DC2626" />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F8F5EF", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: FONT }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Logo */}
      <div style={{ marginBottom: 40, fontSize: 18, fontWeight: 700, color: DARK }}>
        Tablière<span style={{ color: P }}>CI</span>
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        style={{ background: "white", borderRadius: 20, padding: "40px 36px",
          maxWidth: 440, width: "100%", textAlign: "center",
          boxShadow: "0 8px 40px rgba(30,46,40,.1)", border: "0.5px solid #E4DFD8" }}>

        <div style={{ marginBottom: 20 }}>{icons[status]}</div>

        {status === "loading" && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: DARK, margin: "0 0 8px" }}>
              Vérification en cours…
            </h2>
            <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>
              Validation de votre adresse e-mail
            </p>
          </>
        )}

        {(status === "success" || status === "already") && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: DARK, margin: "0 0 8px" }}>
              {status === "already" ? "E-mail déjà vérifié !" : "E-mail vérifié ! ✓"}
            </h2>
            <p style={{ color: MUTED, fontSize: 14, margin: "0 0 28px" }}>
              {status === "success" ? "Votre compte est activé — connexion en cours…" : "Votre compte TablièreCI est activé."}
            </p>
            <button onClick={() => navigate("/connexion")}
              style={{ background: P, color: "#1A1000", border: "none", borderRadius: 10,
                padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Se connecter →
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#DC2626", margin: "0 0 8px" }}>
              Lien invalide ou expiré
            </h2>
            <p style={{ color: MUTED, fontSize: 14, margin: "0 0 24px" }}>
              {message}
            </p>

            {!resent ? (
              <div>
                <p style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>
                  Recevez un nouveau lien de vérification :
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={resendEmail} onChange={e => setResendEmail(e.target.value)}
                    placeholder="votre@email.com" type="email"
                    style={{ flex: 1, border: "0.5px solid #E4DFD8", borderRadius: 8,
                      padding: "10px 12px", fontSize: 13, outline: "none", fontFamily: FONT }} />
                  <button onClick={handleResend} disabled={resending || !resendEmail}
                    style={{ background: P, color: "#1A1000", border: "none", borderRadius: 8,
                      padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      opacity: !resendEmail || resending ? 0.6 : 1 }}>
                    {resending ? "…" : "Renvoyer"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: "#E1F5EE", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: S }}>
                <Mail size={14} style={{ marginRight: 6 }} />
                E-mail envoyé ! Vérifiez votre boîte de réception.
              </div>
            )}
          </>
        )}
      </motion.div>

      <p style={{ marginTop: 24, fontSize: 12, color: MUTED }}>
        <a href="/" style={{ color: P, textDecoration: "none" }}>← Retour à l'accueil</a>
      </p>
    </div>
  );
}
