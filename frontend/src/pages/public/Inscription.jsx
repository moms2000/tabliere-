import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { authService } from "../../services/auth.service.js";
import OtpInput from "../../components/auth/OtpInput.jsx";
import { COUNTRIES } from "../../components/auth/countries.js";
import {
  Mail, Lock, User, Phone, Eye, EyeOff,
  AlertCircle, Calendar, ChevronDown, UtensilsCrossed, X, MessageCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLang } from "../../context/LanguageContext.jsx";

// ── Design tokens ─────────────────────────────────────────────────────────────
const P      = "#E8A045";
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


function getStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_COLORS = ["", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#16A34A"];

export default function Inscription() {
  const navigate          = useNavigate();
  const [searchParams]    = useState(() => new URLSearchParams(window.location.search));
  const { registerPhone, user, logout } = useAuth();
  const { t, lang }       = useLang();
  const isRTL             = lang === "ar";

  const _pt = searchParams.get("type");
  const initialType = _pt === "restaurateur" ? "restaurateur" : _pt === "organisateur" ? "organisateur" : "client";
  const [step,        setStep]        = useState(initialType !== "client" ? 2 : 1);
  const [type,        setType]        = useState(initialType);
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [countryIdx,  setCountryIdx]  = useState(0);
  const [legalModal,  setLegalModal]  = useState(null); // "cgu" | "confidentialite" | null

  // Bloquer le scroll body quand la modal est ouverte
  useEffect(() => {
    if (legalModal) document.body.style.overflow = "hidden";
    else            document.body.style.overflow = "";
    return ()      => { document.body.style.overflow = ""; };
  }, [legalModal]);
  const [showCountry, setShowCountry] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // ── État OTP (vérification du numéro par WhatsApp) ──────────────────────────
  const [otpCode,    setOtpCode]    = useState("");
  const [otpTicket,  setOtpTicket]  = useState("");
  const [devCode,    setDevCode]    = useState("");   // affiché seulement en simulation
  const [otpError,   setOtpError]   = useState("");
  const [resendIn,   setResendIn]   = useState(0);    // compte à rebours avant renvoi
  const [redirecting, setRedirecting] = useState(false);
  const resendTimer = useRef(null);

  // Compte à rebours du bouton « Renvoyer le code »
  useEffect(() => {
    if (resendIn <= 0) return;
    resendTimer.current = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(resendTimer.current);
  }, [resendIn]);

  const [form, setForm] = useState({
    prenom: "", nom: "", email: "",
    date_naissance: "", localPhone: "",
    password: "", resto: "", terms: false,
    code_restaurateur: "", // code obligatoire pour restaurateurs
    code_organisateur: "", // code obligatoire pour organisateurs
  });

  const set        = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const country    = COUNTRIES[countryIdx];
  const strength   = getStrength(form.password);
  const fullPhone  = form.localPhone ? `${country.dial}${form.localPhone.replace(/\s/g, "")}` : "";
  const fullName   = `${form.prenom} ${form.nom}`.trim();

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const validate = () => {
    if (!form.prenom || !form.nom) return t("err_bad_data");
    // Date de naissance facultative : validée seulement si renseignée
    if (form.date_naissance) {
      const age = (Date.now() - new Date(form.date_naissance).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 14) return t("err_age");
    }
    // Le numéro devient l'identifiant principal (code de vérification par WhatsApp)
    if (!form.localPhone) return "Le numéro de téléphone est obligatoire.";
    if (!country.pattern.test(form.localPhone.replace(/\s/g, ""))) return t("err_phone_format");
    // E-mail facultatif : validé seulement s'il est renseigné
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Adresse e-mail invalide.";
    }
    if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password) || form.password.length < 8) {
      return t("err_password_weak");
    }
    if (!form.terms) return t("err_terms");
    // Code restaurateur obligatoire
    if (type === "restaurateur" && !form.code_restaurateur.trim()) {
      return "Le code restaurateur est obligatoire. Contactez l'équipe TablièreCI pour obtenir votre code d'accès.";
    }
    // Code organisateur obligatoire
    if (type === "organisateur" && !form.code_organisateur.trim()) {
      return "Le code organisateur est obligatoire. Contactez l'équipe TablièreCI pour obtenir votre code d'accès.";
    }
    return null;
  };

  // ── Étape 2 → OTP : valider le formulaire puis envoyer le code WhatsApp ──────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    const validErr = validate();
    if (validErr) { setError(validErr); return; }
    setLoading(true);
    try {
      const res = await authService.sendOtp(fullPhone, "register");
      setDevCode(res?.dev_code || "");   // rempli uniquement en mode simulation
      setOtpCode("");
      setOtpError("");
      setResendIn(45);
      setStep("otp");
    } catch (err) {
      const status = err.response?.status;
      if (!status) {
        setError("Impossible de contacter le serveur. Vérifiez votre connexion internet et réessayez.");
      } else if (status === 409) {
        setError(err.response?.data?.message || "Ce numéro a déjà un compte. Connectez-vous.");
      } else if (status === 429) {
        setError(err.response?.data?.message || "Trop de demandes de code. Patientez quelques minutes.");
      } else {
        setError(err.response?.data?.message || "Impossible d'envoyer le code. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Renvoyer un code ────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendIn > 0 || loading) return;
    setOtpError(""); setLoading(true);
    try {
      const res = await authService.sendOtp(fullPhone, "register");
      setDevCode(res?.dev_code || "");
      // Le code précédent est invalidé côté serveur : on repart de zéro pour que
      // le NOUVEAU code soit bien re-vérifié (sinon un ancien ticket serait réutilisé).
      setOtpTicket(""); setOtpCode("");
      setResendIn(45);
    } catch (err) {
      setOtpError(err.response?.data?.message || "Impossible de renvoyer le code.");
    } finally {
      setLoading(false);
    }
  };

  // ── Étape OTP : vérifier le code puis créer le compte (auto-connexion) ───────
  const handleVerifyAndRegister = async (codeArg) => {
    const code = String(codeArg ?? otpCode);
    if (code.length !== 6 || loading) return;
    setOtpError(""); setLoading(true);

    const isResto = type === "restaurateur";
    const isOrga  = type === "organisateur";

    // 1) Vérifier le CODE OTP → ticket signé. Un échec ici = le code est mauvais/
    //    expiré → on reste sur l'écran OTP.
    let ticket = otpTicket;
    if (!ticket) {
      try {
        ticket = await authService.verifyOtp(fullPhone, code, "register");
        setOtpTicket(ticket);
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.message;
        setOtpError(status === 429
          ? (msg || "Trop d'essais. Renvoyez un code.")
          : (msg || "Code incorrect. Vérifiez et réessayez."));
        setOtpCode("");
        setLoading(false);
        return;
      }
    }

    // 2) Créer le compte avec SON mot de passe (numéro déjà vérifié) → auto-login
    try {
      await registerPhone({
        otp_ticket:        ticket,
        full_name:         fullName,
        password:          form.password,
        email:             form.email.trim() || undefined,
        role:              type,
        restaurant_name:   isResto ? form.resto.trim() : undefined,
        code_restaurateur: isResto ? form.code_restaurateur.trim().toUpperCase() : undefined,
        code_organisateur: isOrga  ? form.code_organisateur.trim().toUpperCase() : undefined,
      });
      // Connecté : rediriger vers l'espace correspondant
      setRedirecting(true);
      navigate(isResto ? "/restaurant" : isOrga ? "/event" : "/", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      if (status === 401) {
        // Ticket expiré → recommencer la vérification du numéro
        setOtpError("Vérification expirée. Renvoyez un code.");
        setOtpTicket(""); setOtpCode("");
        setLoading(false);
      } else if (status === 400 || status === 409) {
        // Le numéro est déjà vérifié : un 400/409 vient des INFOS du formulaire
        // (code d'accès restaurateur/organisateur, e-mail déjà pris…). On renvoie
        // l'utilisateur à l'étape 2 avec le message, au lieu de le bloquer sur l'OTP.
        setError(msg || "Vérifiez vos informations (code d'accès, e-mail).");
        setOtpTicket("");
        setStep(2);
        setLoading(false);
      } else if (!status) {
        setOtpError("Impossible de contacter le serveur. Vérifiez votre connexion.");
        setLoading(false);
      } else {
        setOtpError(msg || "Une erreur est survenue. Réessayez.");
        setLoading(false);
      }
    }
  };

  // ── Garde-fou sécurité : bloquer l'inscription si déjà connecté ───────────
  // Empêche un admin/restaurateur/client connecté de créer un nouveau compte
  // sans se déconnecter — évite une session résiduelle exposée sur l'appareil.
  if (user && !redirecting) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 36px",
        border: `0.5px solid ${BORDER}`, maxWidth: 440, width: "100%", textAlign: "center",
        boxShadow: "0 8px 40px rgba(30,46,40,.09)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: DARK, marginBottom: 8 }}>
          Vous êtes déjà connecté
        </h2>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, marginBottom: 24 }}>
          Vous êtes connecté en tant que <strong style={{ color: DARK }}>{user.full_name || user.email}</strong>
          {user.role === "admin" ? " (administrateur)" : user.role === "restaurateur" ? " (restaurateur)" : ""}.
          <br /><br />
          Pour créer un nouveau compte, déconnectez-vous d'abord. Cela protège votre session.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={async () => { await logout(); }}
            style={{ background: P, color: "#1A1000", border: "none", borderRadius: 10,
              padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            Se déconnecter
          </motion.button>
          <button onClick={() => navigate("/")}
            style={{ background: "transparent", border: "none", color: MUTED,
              fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  );

  // ── Étape OTP — vérification du numéro par WhatsApp ────────────────────────
  if (step === "otp") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
      direction: isRTL ? "rtl" : "ltr", fontFamily: FONT }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: "#fff", borderRadius: 16, padding: "40px 34px",
          border: `0.5px solid ${BORDER}`, maxWidth: 420, width: "100%", textAlign: "center",
          boxShadow: "0 8px 40px rgba(30,46,40,.09)" }}>

        <button onClick={() => { setStep(2); setOtpError(""); setOtpCode(""); setOtpTicket(""); }}
          style={{ alignSelf: "flex-start", background: "transparent", border: "none",
            cursor: "pointer", fontSize: 12, color: MUTED, marginBottom: 16,
            display: "flex", alignItems: "center", gap: 5, padding: 0, fontFamily: FONT }}>
          ← Modifier le numéro
        </button>

        {/* Icône WhatsApp */}
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#E7F7EE",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <MessageCircle size={30} color="#1FA855" />
        </div>

        <h2 style={{ fontSize: 21, fontWeight: 600, color: DARK, marginBottom: 8 }}>
          Vérifiez votre numéro
        </h2>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, marginBottom: 22 }}>
          Nous avons envoyé un code à 6 chiffres par WhatsApp au<br />
          <strong style={{ color: DARK, direction: "ltr", unicodeBidi: "embed" }}>{fullPhone}</strong>
        </p>

        {/* Bandeau simulation (dev uniquement — jamais en production) */}
        {devCode && (
          <div style={{ background: "#FEF6EC", border: "0.5px solid #F0C98A", borderRadius: 9,
            padding: "9px 12px", marginBottom: 16, fontSize: 12.5, color: "#7a5a1a" }}>
            Mode test (WhatsApp non configuré) — code : <strong style={{ letterSpacing: 1 }}>{devCode}</strong>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <OtpInput value={otpCode} onChange={setOtpCode}
            onComplete={handleVerifyAndRegister} disabled={loading} accent={P} />
        </div>

        {otpError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 8,
            padding: "9px 12px", marginBottom: 16 }}>
            <AlertCircle size={14} color="#DC2626" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "#DC2626" }}>{otpError}</span>
          </div>
        )}

        <motion.button whileTap={{ scale: 0.97 }} disabled={loading || otpCode.length !== 6}
          onClick={() => handleVerifyAndRegister()}
          style={{ width: "100%", background: (loading || otpCode.length !== 6) ? "#F0C98A" : P,
            color: "#1A1000", border: "none", borderRadius: 9, padding: "13px 0",
            fontSize: 14, fontWeight: 700, cursor: (loading || otpCode.length !== 6) ? "not-allowed" : "pointer",
            fontFamily: FONT, marginBottom: 14 }}>
          {loading ? "Vérification…" : "Créer mon compte"}
        </motion.button>

        <div style={{ fontSize: 12.5, color: MUTED }}>
          Code non reçu ?{" "}
          {resendIn > 0 ? (
            <span style={{ color: MUTED }}>Renvoyer dans {resendIn}s</span>
          ) : (
            <button onClick={handleResend} disabled={loading}
              style={{ background: "none", border: "none", color: P, cursor: "pointer",
                fontSize: 12.5, fontWeight: 600, textDecoration: "underline", fontFamily: FONT }}>
              Renvoyer le code
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );

  // ── Étape 1 — choix du type ───────────────────────────────────────────────
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  if (step === 1) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: isMobile ? "16px" : "24px 16px",
      direction: isRTL ? "rtl" : "ltr", fontFamily: FONT }}>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
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
              Côte d'Ivoire
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 300, color: "#EAE0CC",
              lineHeight: 1.2, letterSpacing: "-0.5px", marginBottom: 14 }}>
              Rejoignez<br />la communauté.
            </h1>
            <p style={{ fontSize: 13, color: "rgba(180,165,130,0.5)", lineHeight: 1.7, maxWidth: 200 }}>
              Gratuit · Confirmation immédiate · Zéro frais cachés
            </p>
          </div>
          {/* Étapes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {["Créez votre compte", "Trouvez votre table", "Savourez le moment"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%",
                  background: i === 0 ? P : "rgba(255,255,255,0.08)",
                  border: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: 10, fontWeight: 600,
                  color: i === 0 ? "#1A1000" : "rgba(180,165,130,0.3)" }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 12, color: i === 0 ? "rgba(180,165,130,0.8)" : "rgba(180,165,130,0.25)" }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Panneau droit */}
        <div style={{ background: "#FAFAF6", padding: "44px 36px",
          display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <button onClick={() => navigate("/")}
            style={{ alignSelf: "flex-start", background: "transparent", border: "none",
              cursor: "pointer", fontSize: 12, color: MUTED, marginBottom: 36,
              display: "flex", alignItems: "center", gap: 5, padding: 0 }}>
            ← Retour à l'accueil
          </button>

          <div style={{ fontSize: 20, fontWeight: 500, color: DARK, marginBottom: 4 }}>{t("reg_title")}</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 28 }}>{t("reg_subtitle")}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { key: "client",       title: t("reg_client_title"), desc: t("reg_client_desc") },
              { key: "restaurateur", title: t("reg_resto_title"),  desc: t("reg_resto_desc")  },
              { key: "organisateur", title: "Organisateur d'événements",
                desc: "Créez vos événements et gérez les réservations de tables & packs VIP" },
            ].map(o => (
              <motion.div key={o.key} whileHover={{ y: -1 }}
                onClick={() => { setType(o.key); setStep(2); }}
                style={{ border: `1.5px solid ${type === o.key ? P : BORDER}`,
                  borderRadius: 12, padding: "16px 18px", cursor: "pointer",
                  background: type === o.key ? "#FEF6EC" : "#fff",
                  transition: "all .15s" }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3,
                  color: type === o.key ? "#C47D1A" : DARK }}>{o.title}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{o.desc}</div>
              </motion.div>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 24 }}>
            {t("reg_already")}{" "}
            <Link to="/connexion" style={{ color: P, fontWeight: 500, textDecoration: "none" }}>
              {t("reg_login")}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );

  // ── Étape 2 — formulaire ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: isMobile ? "16px" : "24px 16px",
      direction: isRTL ? "rtl" : "ltr", fontFamily: FONT }}>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
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
              {type === "restaurateur" ? "Espace restaurateur" : type === "organisateur" ? "Espace organisateur" : "Nouveau compte"}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 300, color: "#EAE0CC",
              lineHeight: 1.2, letterSpacing: "-0.5px", marginBottom: 14 }}>
              {type === "client" ? t("reg_step2_client") : t("reg_step2_resto")}
            </h1>
            <p style={{ fontSize: 12, color: "rgba(180,165,130,0.4)", lineHeight: 1.7 }}>
              {t("reg_step_of")}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {["Créez votre compte", "Trouvez votre table", "Savourez le moment"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%",
                  background: i < 1 ? S : i === 1 ? P : "rgba(255,255,255,0.08)",
                  border: i >= 1 ? "none" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: 10, fontWeight: 600,
                  color: i < 2 ? "white" : "rgba(180,165,130,0.3)" }}>
                  {i < 1 ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 12, color: i < 2 ? "rgba(180,165,130,0.75)" : "rgba(180,165,130,0.2)" }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Formulaire droite */}
        <div style={{ background: "#FAFAF6", padding: isMobile ? "24px 20px" : "32px 28px", overflowY: "auto" }}>

          {/* Logo compact mobile */}
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Logo size={26} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#1E2E28" }}>
                Tablière<span style={{ color: "#E8A045" }}>CI</span>
              </span>
            </div>
          )}

          <button onClick={() => setStep(1)}
            style={{ background: "transparent", border: "none", cursor: "pointer",
              fontSize: 12, color: MUTED, marginBottom: 24, display: "flex",
              alignItems: "center", gap: 5, padding: 0 }}>
            ← {t("reg_prev")}
          </button>

          <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {error && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
                background: "#FEF2F2", border: "0.5px solid #FECACA",
                borderRadius: 8, padding: "10px 13px" }}>
                <AlertCircle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: "#DC2626", lineHeight: 1.4 }}>{error}</span>
              </div>
            )}

            {/* Prénom + Nom */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 0, overflow: "hidden" }}>
              <FField icon={User} label={t("reg_firstname")} type="text"
                value={form.prenom} onChange={v => set("prenom", v)} placeholder="Fatou" required />
              <FField icon={User} label={t("reg_lastname")} type="text"
                value={form.nom} onChange={v => set("nom", v)} placeholder="Amara" required />
            </div>

            {/* Email — facultatif (le numéro est désormais l'identifiant principal) */}
            <FField icon={Mail} label={`${t("reg_email")} (facultatif)`} type="email"
              value={form.email} onChange={v => set("email", v)}
              placeholder="vous@exemple.com" />

            {/* Date de naissance (facultatif) */}
            <div>
              <label style={lbl}>Date de naissance <span style={{ color: MUTED, fontWeight: 400 }}>(facultatif)</span></label>
              <div style={wrap}>
                <Calendar size={14} color={MUTED} />
                <input type="date" value={form.date_naissance}
                  onChange={e => set("date_naissance", e.target.value)}
                  max={new Date(Date.now() - 14 * 365.25 * 86400000).toISOString().split("T")[0]}
                  style={{ border: "none", background: "transparent", fontSize: 13,
                    outline: "none", flex: 1, color: form.date_naissance ? DARK : MUTED, fontFamily: "inherit" }} />
              </div>
            </div>

            {/* Téléphone — identifiant principal, vérifié par WhatsApp */}
            <div>
              <label style={lbl}>{t("reg_phone")} *</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <button type="button" onClick={() => setShowCountry(p => !p)}
                    style={{ display: "flex", alignItems: "center", gap: 6,
                      border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 10px",
                      background: BG, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
                      color: DARK, height: "100%", fontFamily: "inherit" }}>
                    {country.flag} {country.dial}
                    <ChevronDown size={11} color={MUTED} />
                  </button>
                  {showCountry && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                      background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 10,
                      boxShadow: "0 4px 20px rgba(0,0,0,.1)", width: 250,
                      maxHeight: 260, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ padding: "8px 10px", borderBottom: `0.5px solid ${BG}` }}>
                        <input autoFocus placeholder="Rechercher un pays..."
                          value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                          style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 7,
                            padding: "6px 10px", fontSize: 12, outline: "none",
                            color: DARK, fontFamily: "inherit" }} />
                      </div>
                      <div style={{ overflowY: "auto", flex: 1 }}>
                        {filteredCountries.map((c, i) => {
                          const idx = COUNTRIES.indexOf(c);
                          return (
                            <button key={c.code + i} type="button"
                              onClick={() => { setCountryIdx(idx); setShowCountry(false); setCountrySearch(""); }}
                              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                                padding: "8px 12px", border: "none",
                                background: idx === countryIdx ? "#FEF6EC" : "white",
                                cursor: "pointer", fontSize: 12, color: DARK, textAlign: "left",
                                fontFamily: "inherit" }}>
                              {c.flag} <span style={{ flex: 1 }}>{c.name}</span>
                              <span style={{ color: MUTED, fontSize: 11 }}>{c.dial}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ ...wrap, flex: 1 }}>
                  <Phone size={14} color={MUTED} />
                  <input type="tel" value={form.localPhone}
                    onChange={e => set("localPhone", e.target.value)}
                    placeholder={country.ph}
                    style={{ border: "none", background: "transparent", fontSize: 13,
                      outline: "none", flex: 1, color: DARK, fontFamily: "inherit" }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <MessageCircle size={12} color="#1FA855" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
                  Un code de vérification vous sera envoyé par WhatsApp.
                </span>
              </div>
            </div>

            {/* Nom du restaurant + Code accès */}
            {type === "restaurateur" && (
              <>
                <FField icon={UtensilsCrossed} label={t("reg_resto_name")} type="text"
                  value={form.resto} onChange={v => set("resto", v)}
                  placeholder="Le Maquis du Plateau" required />

                {/* Code restaurateur obligatoire */}
                <div>
                  <label style={lbl}>Code d'accès restaurateur *</label>
                  <div style={{ ...wrap, border: form.code_restaurateur ? `0.5px solid ${P}` : wrap.border }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input value={form.code_restaurateur}
                      onChange={e => set("code_restaurateur", e.target.value.toUpperCase())}
                      placeholder="REST-XXXX-XXXX" required
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      style={{ border: "none", background: "transparent", fontSize: 13,
                        outline: "none", flex: 1, color: DARK, fontFamily: "inherit",
                        letterSpacing: "1px", fontWeight: 600 }} />
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>
                    Contactez TablièreCI pour obtenir votre code d'accès.
                  </div>
                </div>
              </>
            )}

            {/* Code organisateur obligatoire */}
            {type === "organisateur" && (
              <div>
                <label style={lbl}>Code d'accès organisateur *</label>
                <div style={{ ...wrap, border: form.code_organisateur ? `0.5px solid ${P}` : wrap.border }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input value={form.code_organisateur}
                    onChange={e => set("code_organisateur", e.target.value.toUpperCase())}
                    placeholder="ORG-XXXX-XXXX" required
                    autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
                    style={{ border: "none", background: "transparent", fontSize: 13,
                      outline: "none", flex: 1, color: DARK, fontFamily: "inherit",
                      letterSpacing: "1px", fontWeight: 600 }} />
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>
                  Contactez TablièreCI pour obtenir votre code d'accès organisateur.
                </div>
              </div>
            )}

            {/* Mot de passe */}
            <div>
              <label style={lbl}>{t("reg_password")}</label>
              <div style={wrap}>
                <Lock size={14} color={MUTED} />
                <input value={form.password} onChange={e => set("password", e.target.value)}
                  type={showPw ? "text" : "password"}
                  placeholder={t("reg_pw_placeholder")} required
                  style={{ border: "none", background: "transparent", fontSize: 13,
                    outline: "none", flex: 1, color: DARK, fontFamily: "inherit" }} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ background: "transparent", border: "none",
                    cursor: "pointer", color: MUTED, display: "flex", padding: 0 }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {form.password && (
                <div style={{ marginTop: 7 }}>
                  <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
                        background: i <= strength ? STRENGTH_COLORS[strength] : BORDER,
                        transition: "background 0.2s" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: STRENGTH_COLORS[strength], fontWeight: 500 }}>
                    {t(`pw_strength_${strength}`)}
                  </div>
                </div>
              )}
            </div>

            {/* CGU */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9,
              fontSize: 12, color: DARK, cursor: "pointer", lineHeight: 1.55 }}>
              <input type="checkbox" checked={form.terms}
                onChange={e => set("terms", e.target.checked)}
                style={{ accentColor: P, marginTop: 2, flexShrink: 0 }} />
              <span style={{ color: MUTED }}>
                {t("reg_terms")}{" "}
                <button type="button"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setLegalModal("cgu"); }}
                  style={{ background: "none", border: "none", padding: 0,
                    color: P, fontWeight: 600, fontSize: 12, cursor: "pointer",
                    fontFamily: "inherit", textDecoration: "underline" }}>
                  {t("reg_terms_link")}
                </button>{" "}
                {t("reg_terms_and")}{" "}
                <button type="button"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setLegalModal("confidentialite"); }}
                  style={{ background: "none", border: "none", padding: 0,
                    color: P, fontWeight: 600, fontSize: 12, cursor: "pointer",
                    fontFamily: "inherit", textDecoration: "underline" }}>
                  {t("reg_terms_privacy")}
                </button>
              </span>
            </label>

            {/* ── Modal légale (Portal) ── */}
            {legalModal && createPortal(
              <div
                onPointerDown={() => setLegalModal(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
                  zIndex: 9999, display: "flex", alignItems: "flex-end",
                  justifyContent: "center", fontFamily: FONT }}>
                <div
                  onPointerDown={e => e.stopPropagation()}
                  style={{ background: "white", borderRadius: "18px 18px 0 0",
                    width: "100%", maxWidth: 600, maxHeight: "80vh",
                    display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "18px 20px 14px", borderBottom: `0.5px solid ${BORDER}`, flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: DARK }}>
                      {legalModal === "cgu" ? "Conditions Générales d'Utilisation" : "Politique de Confidentialité"}
                    </div>
                    <button onPointerDown={() => setLegalModal(null)}
                      style={{ background: "none", border: "none", cursor: "pointer",
                        color: MUTED, display: "flex", padding: 4 }}>
                      <X size={20} />
                    </button>
                  </div>
                  {/* Contenu scrollable */}
                  <div style={{ overflowY: "auto", padding: "20px", flex: 1,
                    fontSize: 13, color: "#555", lineHeight: 1.8 }}>
                    {legalModal === "cgu" ? (
                      <>
                        <p><strong>1. Objet</strong><br/>TablièreCI est une plateforme de réservation de tables de restaurant en Côte d'Ivoire. L'utilisation du service implique l'acceptation des présentes conditions.</p>
                        <p><strong>2. Inscription</strong><br/>L'utilisateur s'engage à fournir des informations exactes lors de l'inscription. Tout compte avec de fausses informations peut être suspendu.</p>
                        <p><strong>3. Réservations</strong><br/>TablièreCI facilite la mise en relation entre clients et restaurants. La réservation est confirmée par e-mail. L'annulation est gratuite jusqu'à 2h avant.</p>
                        <p><strong>4. Responsabilité</strong><br/>TablièreCI ne peut être tenu responsable en cas d'indisponibilité du restaurant, de fermeture exceptionnelle ou de tout incident survenant au restaurant.</p>
                        <p><strong>5. Données personnelles</strong><br/>Vos données sont traitées conformément à notre Politique de Confidentialité et à la loi ivoirienne sur la protection des données.</p>
                        <p><strong>6. Contact</strong><br/>contact@tabliereci.net — tabliereci.net</p>
                      </>
                    ) : (
                      <>
                        <p><strong>1. Données collectées</strong><br/>Nous collectons votre nom, e-mail, téléphone et historique de réservations pour vous fournir le service.</p>
                        <p><strong>2. Utilisation</strong><br/>Vos données servent uniquement à gérer vos réservations, vous envoyer des confirmations et améliorer le service.</p>
                        <p><strong>3. Partage</strong><br/>Vos données de réservation (nom, taille du groupe, heure) sont partagées avec le restaurant concerné. Aucune vente de données à des tiers.</p>
                        <p><strong>4. Sécurité</strong><br/>Les mots de passe sont chiffrés (bcrypt). Les connexions sont sécurisées (HTTPS). Les tokens JWT expirent après 30 jours.</p>
                        <p><strong>5. Vos droits</strong><br/>Vous pouvez demander la suppression de votre compte et de vos données à tout moment via contact@tabliereci.net.</p>
                        <p><strong>6. Contact DPO</strong><br/>contact@tabliereci.net — tabliereci.net</p>
                      </>
                    )}
                  </div>
                  {/* Bouton fermer */}
                  <div style={{ padding: "14px 20px", borderTop: `0.5px solid ${BORDER}`, flexShrink: 0 }}>
                    <button onPointerDown={() => setLegalModal(null)}
                      style={{ width: "100%", background: P, color: "#1A1000",
                        border: "none", borderRadius: 10, padding: "13px 0",
                        fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                      J'ai lu et j'accepte
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
              style={{ background: loading ? "#F0C98A" : P, color: "#1A1000",
                border: "none", borderRadius: 9, padding: "13px 0",
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4, transition: "background 0.2s", fontFamily: "inherit" }}>
              {loading ? "Envoi du code…" : "Recevoir le code WhatsApp"}
            </motion.button>
          </form>

          <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 16 }}>
            {t("reg_already")}{" "}
            <Link to="/connexion" style={{ color: P, fontWeight: 500, textDecoration: "none" }}>
              {t("reg_login")}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function FField({ icon: Icon, label, type, value, onChange, placeholder, required }) {
  return (
    <div style={{ minWidth: 0, overflow: "hidden" }}>
      <label style={lbl}>{label}</label>
      <div style={{ ...wrap, minWidth: 0 }}>
        <Icon size={14} color={MUTED} style={{ flexShrink: 0 }} />
        <input value={value} onChange={e => onChange(e.target.value)}
          type={type} placeholder={placeholder} required={required}
          style={{ border: "none", background: "transparent", fontSize: 13,
            outline: "none", flex: 1, minWidth: 0, color: "#1E2E28", fontFamily: "inherit" }} />
      </div>
    </div>
  );
}

const lbl = {
  fontSize: 11, fontWeight: 500, color: "#6A7A72", display: "block", marginBottom: 6,
  letterSpacing: "0.3px", lineHeight: 1.4,
};
const wrap = {
  display: "flex", alignItems: "center", gap: 10,
  border: `0.5px solid #E4DFD8`, borderRadius: 9, padding: "11px 14px", background: "#F8F5EF",
};
