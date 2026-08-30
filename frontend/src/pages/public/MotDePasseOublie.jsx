import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail, ArrowLeft, CheckCircle, MessageCircle, Phone, Lock, Eye, EyeOff,
  ChevronDown, AlertCircle,
} from "lucide-react";
import api from "../../services/api.js";
import { authService } from "../../services/auth.service.js";
import OtpInput from "../../components/auth/OtpInput.jsx";
import { COUNTRIES } from "../../components/auth/countries.js";

const P = "#E8A045"; const DARK = "#1E2E28"; const MUTED = "#9BA89F";
const BORDER = "#E4DFD8"; const BG = "#F8F5EF";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

const card = {
  background: "white", borderRadius: 16, padding: "38px 34px",
  maxWidth: 420, width: "100%", boxShadow: "0 8px 40px rgba(30,46,40,.09)",
  border: `0.5px solid ${BORDER}`,
};
const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: MUTED,
  textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 };
const wrap = { display: "flex", alignItems: "center", gap: 10,
  border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", background: BG };
const inp = { border: "none", background: "transparent", fontSize: 14,
  outline: "none", flex: 1, color: DARK, fontFamily: FONT };
const btn = (disabled) => ({ width: "100%", background: disabled ? P + "99" : P,
  color: "#1A1000", border: "none", borderRadius: 9, padding: "13px 0",
  fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT });

export default function MotDePasseOublie() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("phone");     // "phone" | "email"

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={card}>
        <button onClick={() => navigate("/connexion")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none",
            border: "none", cursor: "pointer", color: MUTED, fontSize: 13, marginBottom: 22, padding: 0 }}>
          <ArrowLeft size={14} /> Retour à la connexion
        </button>

        {/* Sélecteur de méthode */}
        <div style={{ display: "flex", gap: 8, background: "#F0EDE6", borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {[["phone", "WhatsApp"], ["email", "E-mail"]].map(([m, lab]) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: FONT,
                fontSize: 13, fontWeight: mode === m ? 700 : 500,
                background: mode === m ? "white" : "transparent", color: mode === m ? DARK : MUTED,
                boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
              {lab}
            </button>
          ))}
        </div>

        {mode === "phone" ? <PhoneReset navigate={navigate} /> : <EmailReset navigate={navigate} />}
      </motion.div>
    </div>
  );
}

/* ── Réinitialisation par WhatsApp (OTP) ─────────────────────────────────────── */
function PhoneReset({ navigate }) {
  const [sub,        setSub]        = useState("phone"); // phone | otp | password | done
  const [countryIdx, setCountryIdx] = useState(0);
  const [showCountry, setShowCountry] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  const [otpCode,    setOtpCode]    = useState("");
  const [ticket,     setTicket]     = useState("");
  const [devCode,    setDevCode]    = useState("");
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [resendIn,   setResendIn]   = useState(0);
  const timer = useRef(null);

  const country   = COUNTRIES[countryIdx];
  const fullPhone = localPhone ? `${country.dial}${localPhone.replace(/\s/g, "")}` : "";

  useEffect(() => {
    if (resendIn <= 0) return;
    timer.current = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(timer.current);
  }, [resendIn]);

  const filtered = useMemo(() => {
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q));
  }, [countrySearch]);

  const sendCode = async () => {
    setError("");
    if (!country.pattern.test(localPhone.replace(/\s/g, ""))) { setError("Numéro de téléphone invalide."); return; }
    setLoading(true);
    try {
      const res = await authService.sendOtp(fullPhone, "reset");
      setDevCode(res?.dev_code || "");
      setOtpCode(""); setResendIn(45); setSub("otp");
    } catch (err) {
      const s = err.response?.status;
      setError(s === 429 ? (err.response?.data?.message || "Trop de demandes. Patientez quelques minutes.")
        : (err.response?.data?.message || "Impossible d'envoyer le code. Réessayez."));
    } finally { setLoading(false); }
  };

  const verify = async (codeArg) => {
    const code = String(codeArg ?? otpCode);
    if (code.length !== 6 || loading) return;
    setError(""); setLoading(true);
    try {
      const tk = await authService.verifyOtp(fullPhone, code, "reset");
      setTicket(tk); setSub("password");
    } catch (err) {
      const s = err.response?.status;
      setError(s === 400 ? "Code incorrect. Vérifiez et réessayez."
        : s === 429 ? "Trop d'essais. Redemandez un code."
        : (err.response?.data?.message || "Vérification impossible. Réessayez."));
      setOtpCode("");
    } finally { setLoading(false); }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) || password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères, avec lettres et chiffres."); return;
    }
    setLoading(true);
    try {
      await authService.resetPasswordPhone(ticket, password);
      setSub("done");
    } catch (err) {
      const s = err.response?.status;
      setError(s === 401 ? "Vérification expirée. Recommencez."
        : (err.response?.data?.message || "Impossible de changer le mot de passe. Réessayez."));
      if (s === 401) { setSub("phone"); setTicket(""); }
    } finally { setLoading(false); }
  };

  const resend = async () => {
    if (resendIn > 0 || loading) return;
    setError(""); setLoading(true);
    try {
      const res = await authService.sendOtp(fullPhone, "reset");
      setDevCode(res?.dev_code || ""); setResendIn(45);
    } catch { setError("Impossible de renvoyer le code."); }
    finally { setLoading(false); }
  };

  const errBox = error && (
    <div style={{ display: "flex", alignItems: "center", gap: 8,
      background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 8,
      padding: "9px 12px", marginBottom: 14 }}>
      <AlertCircle size={14} color="#DC2626" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: "#DC2626" }}>{error}</span>
    </div>
  );

  if (sub === "done") return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#E1F5EE",
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <CheckCircle size={30} color="#1D9E75" />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: DARK, marginBottom: 10 }}>Mot de passe modifié !</h2>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
        Votre mot de passe a été mis à jour. Connectez-vous avec vos nouveaux identifiants.
      </p>
      <button onClick={() => navigate("/connexion")} style={btn(false)}>Se connecter</button>
    </div>
  );

  if (sub === "otp") return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#E7F7EE",
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
        <MessageCircle size={28} color="#1FA855" />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: DARK, marginBottom: 8 }}>Entrez le code</h2>
      <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.6, marginBottom: 20 }}>
        Code à 6 chiffres envoyé par WhatsApp au<br />
        <strong style={{ color: DARK, direction: "ltr", unicodeBidi: "embed" }}>{fullPhone}</strong>
      </p>
      {devCode && (
        <div style={{ background: "#FEF6EC", border: "0.5px solid #F0C98A", borderRadius: 9,
          padding: "9px 12px", marginBottom: 16, fontSize: 12.5, color: "#7a5a1a" }}>
          Mode test — code : <strong style={{ letterSpacing: 1 }}>{devCode}</strong>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <OtpInput value={otpCode} onChange={setOtpCode} onComplete={verify} disabled={loading} accent={P} />
      </div>
      {errBox}
      <button onClick={() => verify()} disabled={loading || otpCode.length !== 6}
        style={{ ...btn(loading || otpCode.length !== 6), marginBottom: 14 }}>
        {loading ? "Vérification…" : "Vérifier"}
      </button>
      <div style={{ fontSize: 12.5, color: MUTED }}>
        Code non reçu ?{" "}
        {resendIn > 0 ? <span>Renvoyer dans {resendIn}s</span> : (
          <button onClick={resend} disabled={loading}
            style={{ background: "none", border: "none", color: P, cursor: "pointer",
              fontSize: 12.5, fontWeight: 600, textDecoration: "underline", fontFamily: FONT }}>
            Renvoyer le code
          </button>
        )}
      </div>
    </div>
  );

  if (sub === "password") return (
    <>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FEF6EC",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Lock size={24} color={P} />
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 500, color: DARK, marginBottom: 8 }}>Nouveau mot de passe</h2>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
        Numéro vérifié. Choisissez votre nouveau mot de passe.
      </p>
      <form onSubmit={submitPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {errBox}
        <div>
          <label style={lbl}>Nouveau mot de passe</label>
          <div style={wrap}>
            <Lock size={14} color={MUTED} />
            <input value={password} onChange={e => setPassword(e.target.value)}
              type={showPw ? "text" : "password"} placeholder="Au moins 8 caractères" required style={inp} />
            <button type="button" onClick={() => setShowPw(p => !p)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: MUTED, display: "flex", padding: 0 }}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} style={btn(loading)}>
          {loading ? "Enregistrement…" : "Changer le mot de passe"}
        </button>
      </form>
    </>
  );

  // sub === "phone"
  return (
    <>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "#E7F7EE",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <MessageCircle size={24} color="#1FA855" />
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 500, color: DARK, marginBottom: 8 }}>Mot de passe oublié ?</h2>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
        Entrez votre numéro. Nous vous enverrons un code de vérification par WhatsApp.
      </p>
      <form onSubmit={e => { e.preventDefault(); sendCode(); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {errBox}
        <div>
          <label style={lbl}>Numéro de téléphone</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setShowCountry(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: 6,
                  border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 10px",
                  background: BG, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
                  color: DARK, height: "100%", fontFamily: FONT }}>
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
                        padding: "6px 10px", fontSize: 12, outline: "none", color: DARK, fontFamily: FONT }} />
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    {filtered.map((c, i) => {
                      const idx = COUNTRIES.indexOf(c);
                      return (
                        <button key={c.code + i} type="button"
                          onClick={() => { setCountryIdx(idx); setShowCountry(false); setCountrySearch(""); }}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                            padding: "8px 12px", border: "none",
                            background: idx === countryIdx ? "#FEF6EC" : "white",
                            cursor: "pointer", fontSize: 12, color: DARK, textAlign: "left", fontFamily: FONT }}>
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
              <input type="tel" value={localPhone} onChange={e => setLocalPhone(e.target.value)}
                placeholder={country.ph} style={inp} />
            </div>
          </div>
        </div>
        <button type="submit" disabled={loading} style={btn(loading)}>
          {loading ? "Envoi du code…" : "Recevoir le code WhatsApp"}
        </button>
      </form>
    </>
  );
}

/* ── Réinitialisation par e-mail (lien) — comptes historiques ─────────────────── */
function EmailReset({ navigate }) {
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

  if (done) return (
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
      <button onClick={() => navigate("/connexion")} style={btn(false)}>Retour à la connexion</button>
    </div>
  );

  return (
    <>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FEF6EC",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Mail size={24} color={P} />
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 500, color: DARK, marginBottom: 8 }}>Mot de passe oublié ?</h2>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
        Entrez votre adresse e-mail. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div style={{ background: "#FAECE7", border: "0.5px solid #FECACA",
            borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#993C1D" }}>{error}</div>
        )}
        <div>
          <label style={lbl}>Adresse e-mail</label>
          <div style={wrap}>
            <Mail size={14} color={MUTED} />
            <input value={email} onChange={e => setEmail(e.target.value)}
              type="email" placeholder="vous@exemple.com" required style={inp} />
          </div>
        </div>
        <button type="submit" disabled={loading} style={btn(loading)}>
          {loading ? "Envoi en cours…" : "Envoyer le lien"}
        </button>
      </form>
    </>
  );
}
