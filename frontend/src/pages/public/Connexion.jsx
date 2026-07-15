import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, AlertCircle, UtensilsCrossed, User, PartyPopper } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { authService } from "../../services/auth.service.js";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

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

/* ── Étape 1 : Choix du type de compte ───────────────────────────────────────── */
function StepChoix({ onChoose }) {
  const navigate  = useNavigate();
  const isMobile  = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: isMobile ? "16px" : "24px 16px", fontFamily: FONT }}>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: "100%", maxWidth: isMobile ? 440 : 860, display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", borderRadius: 16, overflow: "hidden",
          border: `0.5px solid ${BORDER}`, boxShadow: "0 8px 40px rgba(30,46,40,.09)" }}>

        {/* Panneau gauche — caché sur mobile */}
        <div style={{ background: DARK, padding: "44px 36px",
          display: isMobile ? "none" : "flex", flexDirection: "column", justifyContent: "space-between" }}>
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
            {[
              { n: "142", label: "Tables libres", color: P },
              { n: "4.8", label: "Note moyenne",  color: S },
              { n: "34",  label: "Restaurants",   color: "#EAE0CC" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 26, fontWeight: 300, color: s.color, lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
                  color: "rgba(180,165,130,0.3)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Panneau droit — choix */}
        <div style={{ background: "#FAFAF6", padding: "44px 36px",
          display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <button onClick={() => navigate("/")}
            style={{ alignSelf: "flex-start", background: "transparent", border: "none",
              cursor: "pointer", fontSize: 12, color: MUTED, marginBottom: 28,
              display: "flex", alignItems: "center", gap: 5, padding: 0, fontFamily: FONT }}>
            ← Retour à l'accueil
          </button>

          <div style={{ fontSize: 20, fontWeight: 500, color: DARK, marginBottom: 6 }}>Connexion</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 32 }}>
            Choisissez votre espace de connexion
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                type: "client",
                icon: User,
                title: "Client",
                sub: "Réservez et gérez vos tables",
                bg: PL,
                border: `0.5px solid ${P}44`,
              },
              {
                type: "restaurateur",
                icon: UtensilsCrossed,
                title: "Restaurateur",
                sub: "Gérez votre restaurant et réservations",
                bg: "#F0F6F2",
                border: `0.5px solid ${S}44`,
              },
              {
                type: "organisateur",
                icon: PartyPopper,
                title: "Organisateur",
                sub: "Gérez vos événements et réservations",
                bg: PL,
                border: `0.5px solid ${P}44`,
              },
            ].map(opt => (
              <motion.button key={opt.type} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={() => onChoose(opt.type)}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px",
                  borderRadius: 12, border: opt.border, background: opt.bg,
                  cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
                <div style={{ width: 44, height: 44, borderRadius: 11,
                  background: (opt.type === "restaurateur" ? S : P) + "22",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <opt.icon size={20} color={opt.type === "restaurateur" ? S : P} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: DARK, marginBottom: 3 }}>
                    {opt.title}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED }}>{opt.sub}</div>
                </div>
              </motion.button>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 28 }}>
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

/* ── Étape 2 : Formulaire de connexion ───────────────────────────────────────── */
function StepForm({ type, onBack }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, logout } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [needsVerif, setNeedsVerif] = useState(""); // email à re-vérifier
  const [resent,   setResent]   = useState(false);

  const doResend = async () => {
    try { await authService.resendVerification(needsVerif); setResent(true); } catch { setResent(true); }
  };

  const from = location.state?.from?.pathname || null;

  const isResto = type === "restaurateur";
  const isOrga  = type === "organisateur";
  const accentColor = isResto ? S : P;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password, remember);

      // Vérification du rôle selon l'espace choisi
      // Vérifier la cohérence rôle/espace choisi
      if (type === "client" && user.role !== "client") {
        await logout();
        setError(user.role === "admin"
          ? "Ce compte est un compte administrateur. Accédez à l'espace Admin."
          : user.role === "restaurateur"
          ? "Ce compte est un compte restaurateur. Utilisez l'espace Restaurateur."
          : "Ce compte est un compte organisateur. Utilisez l'espace Organisateur.");
        setLoading(false);
        return;
      }
      if (type === "restaurateur" && user.role !== "restaurateur") {
        await logout();
        setError(user.role === "admin"
          ? "Les administrateurs n'ont pas accès à l'espace restaurateur."
          : "Ce compte n'est pas un compte restaurateur. Utilisez le bon espace.");
        setLoading(false);
        return;
      }
      if (type === "organisateur" && user.role !== "organisateur") {
        await logout();
        setError(user.role === "admin"
          ? "Les administrateurs n'ont pas accès à l'espace organisateur."
          : "Ce compte n'est pas un compte organisateur. Utilisez le bon espace.");
        setLoading(false);
        return;
      }

      // Redirection stricte par rôle — pas de cross-role navigation
      if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (user.role === "restaurateur") {
        navigate("/restaurant", { replace: true });
      } else if (user.role === "organisateur") {
        navigate("/event", { replace: true });
      } else {
        // Client — rediriger vers la destination d'origine ou l'accueil
        if (from && !from.startsWith("/admin") && !from.startsWith("/restaurant")) {
          navigate(from, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 400) {
        setError("Email ou mot de passe incorrect.");
      } else if (status === 403 && err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerif(err.response?.data?.email || email); setResent(false); setError("");
      } else if (status === 403) {
        setError("Votre compte a été suspendu. Contactez le support.");
      } else {
        setError(err.response?.data?.message || "Une erreur est survenue. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: isMobile ? "16px" : "24px 16px", fontFamily: FONT }}>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: "100%", maxWidth: isMobile ? 440 : 860, display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", borderRadius: 16, overflow: "hidden",
          border: `0.5px solid ${BORDER}`, boxShadow: "0 8px 40px rgba(30,46,40,.09)" }}>

        {/* Panneau gauche — caché sur mobile */}
        <div style={{ background: DARK, padding: "44px 36px",
          display: isMobile ? "none" : "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 52 }}>
              <Logo size={30} />
              <span style={{ fontSize: 16, fontWeight: 400, color: "#EAE0CC" }}>
                Tablière<span style={{ color: P, fontWeight: 500 }}>CI</span>
              </span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
              background: accentColor + "22", borderRadius: 8, padding: "6px 12px", marginBottom: 20 }}>
              {isResto
                ? <UtensilsCrossed size={14} color={accentColor} />
                : <User size={14} color={accentColor} />}
              <span style={{ fontSize: 11, color: accentColor, fontWeight: 600 }}>
                Espace {isResto ? "Restaurateur" : isOrga ? "Organisateur" : "Client"}
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 300, color: "#EAE0CC",
              lineHeight: 1.2, letterSpacing: "-0.5px", marginBottom: 14 }}>
              {isResto ? "Gérez vos tables\net réservations." : isOrga ? "Gérez vos\névénements." : "Bon retour\nparmi nous."}
            </h1>
            <p style={{ fontSize: 13, color: "rgba(180,165,130,0.5)", lineHeight: 1.7 }}>
              {isResto
                ? "Dashboard, menu, plan de salle — tout en un."
                : "Les meilleures tables d'Abidjan vous attendent."}
            </p>
          </div>
          <button onClick={onBack}
            style={{ background: "transparent", border: `0.5px solid rgba(255,255,255,.15)`,
              borderRadius: 8, padding: "8px 16px", color: "rgba(255,255,255,.4)",
              cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: FONT }}>
            ← Changer de type de compte
          </button>
        </div>

        {/* Panneau droit */}
        <div style={{ background: "#FAFAF6", padding: isMobile ? "28px 20px" : "44px 36px",
          display: "flex", flexDirection: "column", justifyContent: "center" }}>

          {/* Logo compact mobile */}
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <Logo size={28} />
              <span style={{ fontSize: 16, fontWeight: 600, color: DARK }}>
                Tablière<span style={{ color: P }}>CI</span>
              </span>
            </div>
          )}

          <button onClick={() => navigate("/")}
            style={{ alignSelf: "flex-start", background: "transparent", border: "none",
              cursor: "pointer", fontSize: 12, color: MUTED, marginBottom: 28,
              display: "flex", alignItems: "center", gap: 5, padding: 0, fontFamily: FONT }}>
            ← Retour à l'accueil
          </button>

          <div style={{ fontSize: 20, fontWeight: 500, color: DARK, marginBottom: 4 }}>Connexion</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 28 }}>
            Accédez à votre espace {isResto ? "restaurateur" : isOrga ? "organisateur" : "client"}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                background: "#FEF2F2", border: "0.5px solid #FECACA",
                borderRadius: 8, padding: "10px 13px" }}>
                <AlertCircle size={14} color="#DC2626" />
                <span style={{ fontSize: 13, color: "#DC2626" }}>{error}</span>
              </div>
            )}

            {needsVerif && (
              <div style={{ background: "#FEF6EC", border: "0.5px solid #F0C98A", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Mail size={15} color="#C47D1A" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#7a5a1a" }}>E-mail non vérifié</span>
                </div>
                <div style={{ fontSize: 12.5, color: "#7a5a1a", lineHeight: 1.5 }}>
                  Vous devez confirmer votre adresse <strong>{needsVerif}</strong> avant de vous connecter. Vérifiez votre boîte mail (et les spams).
                </div>
                {resent ? (
                  <div style={{ fontSize: 12.5, color: "#1D9E75", fontWeight: 600, marginTop: 8 }}>✓ Nouvel e-mail de vérification envoyé.</div>
                ) : (
                  <button type="button" onClick={doResend}
                    style={{ marginTop: 8, border: "none", background: "#E8A045", color: "#1A1000", borderRadius: 8,
                      padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                    Renvoyer l'e-mail de vérification
                  </button>
                )}
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
                <span style={{ fontSize: 11, color: accentColor, cursor: "pointer" }}>
                  <a href="/mot-de-passe-oublie" style={{ color: accentColor, textDecoration: "none" }}>
                    Mot de passe oublié ?
                  </a>
                </span>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", userSelect: "none" }}>
              <div onClick={() => setRemember(p => !p)}
                style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                  background: remember ? accentColor : BORDER, position: "relative",
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
              style={{ background: loading ? accentColor + "99" : accentColor,
                color: isResto ? "white" : "#1A1000",
                border: "none", borderRadius: 9, padding: "13px 0",
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4, transition: "background 0.2s", fontFamily: FONT }}>
              {loading ? "Connexion en cours…" : "Se connecter"}
            </motion.button>
          </form>

          <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 20 }}>
            Pas encore de compte ?{" "}
            <Link to={`/inscription?type=${isResto ? "restaurateur" : isOrga ? "organisateur" : "client"}`}
              style={{ color: accentColor, fontWeight: 500, textDecoration: "none" }}>
              S'inscrire
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Composant principal ─────────────────────────────────────────────────────── */
export default function Connexion() {
  const [step, setStep] = useState("choix"); // "choix" | "client" | "restaurateur"
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const initialCheckDone = React.useRef(false);

  // Rediriger UNIQUEMENT si l'utilisateur est DÉJÀ connecté en arrivant sur
  // la page (session existante). Pendant une tentative de connexion sur cette
  // page, c'est handleSubmit qui gère la redirection APRÈS vérification du
  // rôle (sinon un client se connectant sur l'espace restaurateur serait
  // redirigé avant de voir le message d'erreur).
  React.useEffect(() => {
    if (loading) return;                 // attendre le chargement de la session
    if (initialCheckDone.current) return; // ne s'exécute qu'une fois
    initialCheckDone.current = true;
    if (user) {
      if (user.role === "admin")             nav("/admin",      { replace: true });
      else if (user.role === "restaurateur") nav("/restaurant", { replace: true });
      else                                   nav("/",           { replace: true });
    }
  }, [loading, user, nav]);

  return (
    <AnimatePresence mode="wait">
      {step === "choix" ? (
        <motion.div key="choix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <StepChoix onChoose={(type) => setStep(type)} />
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <StepForm type={step} onBack={() => setStep("choix")} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const labelSt = {
  fontSize: 11, fontWeight: 500, color: MUTED, display: "block", marginBottom: 6, fontFamily: FONT,
};
const wrapSt = {
  display: "flex", alignItems: "center", gap: 10,
  border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", background: BG,
};
const inpSt = {
  border: "none", background: "transparent", fontSize: 13,
  outline: "none", flex: 1, color: DARK, fontFamily: FONT,
};
