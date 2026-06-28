import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail, Lock, User, Phone, Eye, EyeOff,
  CheckCircle, AlertCircle, Calendar, ChevronDown, UtensilsCrossed,
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

// ── Indicatifs pays ───────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire",   dial: "+225", flag: "🇨🇮", pattern: /^\d{10}$/,     ph: "07 00 00 00 00" },
  { code: "SN", name: "Sénégal",         dial: "+221", flag: "🇸🇳", pattern: /^\d{9}$/,      ph: "77 000 00 00"  },
  { code: "ML", name: "Mali",            dial: "+223", flag: "🇲🇱", pattern: /^\d{8}$/,      ph: "70 00 00 00"   },
  { code: "BF", name: "Burkina Faso",    dial: "+226", flag: "🇧🇫", pattern: /^\d{8}$/,      ph: "70 00 00 00"   },
  { code: "GH", name: "Ghana",           dial: "+233", flag: "🇬🇭", pattern: /^\d{9}$/,      ph: "20 000 0000"   },
  { code: "NG", name: "Nigeria",         dial: "+234", flag: "🇳🇬", pattern: /^\d{10}$/,     ph: "802 000 0000"  },
  { code: "GN", name: "Guinée",          dial: "+224", flag: "🇬🇳", pattern: /^\d{9}$/,      ph: "622 00 00 00"  },
  { code: "CM", name: "Cameroun",        dial: "+237", flag: "🇨🇲", pattern: /^\d{9}$/,      ph: "670 00 00 00"  },
  { code: "TG", name: "Togo",            dial: "+228", flag: "🇹🇬", pattern: /^\d{8}$/,      ph: "90 00 00 00"   },
  { code: "BJ", name: "Bénin",           dial: "+229", flag: "🇧🇯", pattern: /^\d{8}$/,      ph: "90 00 00 00"   },
  { code: "NE", name: "Niger",           dial: "+227", flag: "🇳🇪", pattern: /^\d{8}$/,      ph: "90 00 00 00"   },
  { code: "LR", name: "Liberia",         dial: "+231", flag: "🇱🇷", pattern: /^\d{7,8}$/,    ph: "770 0000"      },
  { code: "SL", name: "Sierra Leone",    dial: "+232", flag: "🇸🇱", pattern: /^\d{8}$/,      ph: "76 000 000"    },
  { code: "GM", name: "Gambie",          dial: "+220", flag: "🇬🇲", pattern: /^\d{7}$/,      ph: "300 0000"      },
  { code: "CD", name: "Congo (RDC)",     dial: "+243", flag: "🇨🇩", pattern: /^\d{9}$/,      ph: "81 000 0000"   },
  { code: "CG", name: "Congo (Brazza)",  dial: "+242", flag: "🇨🇬", pattern: /^\d{9}$/,      ph: "06 000 0000"   },
  { code: "GA", name: "Gabon",           dial: "+241", flag: "🇬🇦", pattern: /^\d{7,8}$/,    ph: "060 00 00"     },
  { code: "KE", name: "Kenya",           dial: "+254", flag: "🇰🇪", pattern: /^\d{9}$/,      ph: "712 000 000"   },
  { code: "TZ", name: "Tanzanie",        dial: "+255", flag: "🇹🇿", pattern: /^\d{9}$/,      ph: "712 000 000"   },
  { code: "MA", name: "Maroc",           dial: "+212", flag: "🇲🇦", pattern: /^\d{9}$/,      ph: "612 34 56 78"  },
  { code: "DZ", name: "Algérie",         dial: "+213", flag: "🇩🇿", pattern: /^\d{9}$/,      ph: "555 12 34 56"  },
  { code: "TN", name: "Tunisie",         dial: "+216", flag: "🇹🇳", pattern: /^\d{8}$/,      ph: "20 000 000"    },
  { code: "EG", name: "Égypte",          dial: "+20",  flag: "🇪🇬", pattern: /^\d{10}$/,     ph: "100 000 0000"  },
  { code: "FR", name: "France",          dial: "+33",  flag: "🇫🇷", pattern: /^[67]\d{8}$/,  ph: "6 12 34 56 78" },
  { code: "BE", name: "Belgique",        dial: "+32",  flag: "🇧🇪", pattern: /^[4]\d{8}$/,   ph: "470 00 00 00"  },
  { code: "CH", name: "Suisse",          dial: "+41",  flag: "🇨🇭", pattern: /^[78]\d{8}$/,  ph: "76 000 00 00"  },
  { code: "GB", name: "Royaume-Uni",     dial: "+44",  flag: "🇬🇧", pattern: /^[7]\d{9}$/,   ph: "7700 000000"   },
  { code: "DE", name: "Allemagne",       dial: "+49",  flag: "🇩🇪", pattern: /^\d{10,11}$/,  ph: "1512 3456789"  },
  { code: "ES", name: "Espagne",         dial: "+34",  flag: "🇪🇸", pattern: /^[67]\d{8}$/,  ph: "612 34 56 78"  },
  { code: "IT", name: "Italie",          dial: "+39",  flag: "🇮🇹", pattern: /^[3]\d{9}$/,   ph: "312 345 6789"  },
  { code: "PT", name: "Portugal",        dial: "+351", flag: "🇵🇹", pattern: /^9\d{8}$/,     ph: "912 345 678"   },
  { code: "US", name: "États-Unis",      dial: "+1",   flag: "🇺🇸", pattern: /^\d{10}$/,     ph: "202 555 0100"  },
  { code: "CA", name: "Canada",          dial: "+1",   flag: "🇨🇦", pattern: /^\d{10}$/,     ph: "613 555 0100"  },
  { code: "SA", name: "Arabie Saoudite", dial: "+966", flag: "🇸🇦", pattern: /^5\d{8}$/,     ph: "50 000 0000"   },
  { code: "AE", name: "Émirats arabes",  dial: "+971", flag: "🇦🇪", pattern: /^5\d{8}$/,     ph: "50 000 0000"   },
  { code: "LB", name: "Liban",           dial: "+961", flag: "🇱🇧", pattern: /^[37]\d{7}$/,  ph: "3 000 000"     },
  { code: "CN", name: "Chine",           dial: "+86",  flag: "🇨🇳", pattern: /^\d{11}$/,     ph: "131 0000 0000" },
  { code: "IN", name: "Inde",            dial: "+91",  flag: "🇮🇳", pattern: /^\d{10}$/,     ph: "91234 56789"   },
];

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
  const { register, login } = useAuth();
  const { t, lang }       = useLang();
  const isRTL             = lang === "ar";

  const [step,        setStep]        = useState(1);
  const [type,        setType]        = useState("client");
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [countryIdx,  setCountryIdx]  = useState(0);
  const [showCountry, setShowCountry] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const [form, setForm] = useState({
    prenom: "", nom: "", email: "",
    date_naissance: "", localPhone: "",
    password: "", resto: "", terms: false,
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
    if (form.date_naissance) {
      const age = (Date.now() - new Date(form.date_naissance).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 14) return t("err_age");
    } else {
      return t("err_bad_data");
    }
    if (form.localPhone) {
      if (!country.pattern.test(form.localPhone.replace(/\s/g, ""))) return t("err_phone_format");
    }
    if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password) || form.password.length < 8) {
      return t("err_password_weak");
    }
    if (!form.terms) return t("err_terms");
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const validErr = validate();
    if (validErr) { setError(validErr); return; }
    setLoading(true);
    try {
      await register({
        full_name:       fullName,
        email:           form.email,
        phone:           fullPhone || undefined,
        password:        form.password,
        role:            type,
        restaurant_name: type === "restaurateur" ? form.resto : undefined,
      });
      try { await login(form.email, form.password); } catch (_) {}
      setStep(3);
    } catch (err) {
      const status = err.response?.status;
      if (status === 409)      setError(t("err_email_taken"));
      else if (status === 400) setError(err.response?.data?.message || t("err_bad_data"));
      else                     setError(err.response?.data?.message || t("err_generic"));
    } finally {
      setLoading(false);
    }
  };

  // ── Succès — Vérification email requise ───────────────────────────────────
  if (step === 3) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
      direction: isRTL ? "rtl" : "ltr", fontFamily: FONT }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: "#fff", borderRadius: 16, padding: "44px 40px",
          border: `0.5px solid ${BORDER}`, maxWidth: 420, width: "100%", textAlign: "center",
          boxShadow: "0 8px 40px rgba(30,46,40,.09)" }}>
        {/* Icône e-mail animée */}
        <motion.div
          animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          style={{ width: 72, height: 72, borderRadius: "50%", background: "#FEF6EC",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Mail size={36} color={P} />
        </motion.div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: DARK, marginBottom: 8 }}>
          Vérifiez votre e-mail !
        </h2>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 24 }}>
          Un lien d'activation a été envoyé à<br />
          <strong style={{ color: DARK }}>{form.email}</strong>
          <br /><br />
          Cliquez sur le lien dans l'e-mail pour activer votre compte. Vérifiez aussi vos spams.
        </p>

        {/* Étapes */}
        {[
          { num: "1", text: "Ouvrez votre boîte de réception" },
          { num: "2", text: `Cherchez l'e-mail de TablièreCI` },
          { num: "3", text: "Cliquez sur « Activer mon compte »" },
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left",
            marginBottom: 10, padding: "8px 12px", background: BG, borderRadius: 9 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: P,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#1A1000", flexShrink: 0 }}>
              {s.num}
            </div>
            <span style={{ fontSize: 13, color: DARK }}>{s.text}</span>
          </div>
        ))}

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => navigate(type === "restaurateur" ? "/restaurant" : "/")}
            style={{ background: P, color: "#1A1000", border: "none", borderRadius: 9,
              padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {type === "restaurateur" ? "Accéder à mon espace" : "Continuer"}
          </motion.button>
          <span style={{ fontSize: 12, color: MUTED }}>
            Vous n'avez pas reçu l'email ?{" "}
            <button onClick={async () => {
              try {
                const res = await fetch((import.meta.env.VITE_API_URL || "/api/v1") + "/auth/resend-verification",
                  { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email: form.email }) });
                alert("E-mail renvoyé !");
              } catch (_) { alert("E-mail renvoyé !"); }
            }} style={{ background: "none", border: "none", color: P, cursor: "pointer",
              fontSize: 12, fontWeight: 600, textDecoration: "underline" }}>
              Renvoyer
            </button>
          </span>
        </div>
      </motion.div>
    </div>
  );

  // ── Étape 1 — choix du type ───────────────────────────────────────────────
  if (step === 1) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px 16px",
      direction: isRTL ? "rtl" : "ltr", fontFamily: FONT }}>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: "100%", maxWidth: 860, display: "grid",
          gridTemplateColumns: "1fr 1fr", borderRadius: 16, overflow: "hidden",
          border: `0.5px solid ${BORDER}`, boxShadow: "0 8px 40px rgba(30,46,40,.09)" }}>

        {/* Panneau gauche */}
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
              { key: "client",       titleK: "reg_client_title", descK: "reg_client_desc" },
              { key: "restaurateur", titleK: "reg_resto_title",  descK: "reg_resto_desc"  },
            ].map(o => (
              <motion.div key={o.key} whileHover={{ y: -1 }}
                onClick={() => { setType(o.key); setStep(2); }}
                style={{ border: `1.5px solid ${type === o.key ? P : BORDER}`,
                  borderRadius: 12, padding: "16px 18px", cursor: "pointer",
                  background: type === o.key ? "#FEF6EC" : "#fff",
                  transition: "all .15s" }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3,
                  color: type === o.key ? "#C47D1A" : DARK }}>{t(o.titleK)}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{t(o.descK)}</div>
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
      alignItems: "center", justifyContent: "center", padding: "24px 16px",
      direction: isRTL ? "rtl" : "ltr", fontFamily: FONT }}>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: "100%", maxWidth: 860, display: "grid",
          gridTemplateColumns: "1fr 1fr", borderRadius: 16, overflow: "hidden",
          border: `0.5px solid ${BORDER}`, boxShadow: "0 8px 40px rgba(30,46,40,.09)" }}>

        {/* Panneau gauche */}
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
              {type === "restaurateur" ? "Espace restaurateur" : "Nouveau compte"}
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
        <div style={{ background: "#FAFAF6", padding: "32px 28px", overflowY: "auto" }}>
          <button onClick={() => setStep(1)}
            style={{ background: "transparent", border: "none", cursor: "pointer",
              fontSize: 12, color: MUTED, marginBottom: 24, display: "flex",
              alignItems: "center", gap: 5, padding: 0 }}>
            ← {t("reg_prev")}
          </button>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {error && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
                background: "#FEF2F2", border: "0.5px solid #FECACA",
                borderRadius: 8, padding: "10px 13px" }}>
                <AlertCircle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: "#DC2626", lineHeight: 1.4 }}>{error}</span>
              </div>
            )}

            {/* Prénom + Nom */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FField icon={User} label={t("reg_firstname")} type="text"
                value={form.prenom} onChange={v => set("prenom", v)} placeholder="Fatou" required />
              <FField icon={User} label={t("reg_lastname")} type="text"
                value={form.nom} onChange={v => set("nom", v)} placeholder="Amara" required />
            </div>

            {/* Email */}
            <FField icon={Mail} label={t("reg_email")} type="email"
              value={form.email} onChange={v => set("email", v)}
              placeholder="vous@exemple.com" required />

            {/* Date de naissance */}
            <div>
              <label style={lbl}>Date de naissance</label>
              <div style={wrap}>
                <Calendar size={14} color={MUTED} />
                <input type="date" value={form.date_naissance}
                  onChange={e => set("date_naissance", e.target.value)}
                  max={new Date(Date.now() - 14 * 365.25 * 86400000).toISOString().split("T")[0]}
                  required
                  style={{ border: "none", background: "transparent", fontSize: 13,
                    outline: "none", flex: 1, color: form.date_naissance ? DARK : MUTED, fontFamily: "inherit" }} />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label style={lbl}>{t("reg_phone")}</label>
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
            </div>

            {/* Nom du restaurant */}
            {type === "restaurateur" && (
              <FField icon={UtensilsCrossed} label={t("reg_resto_name")} type="text"
                value={form.resto} onChange={v => set("resto", v)}
                placeholder="Le Maquis du Plateau" required />
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
                <a href="/cgu" target="_blank" style={{ color: P, textDecoration: "none", fontWeight: 500 }}>
                  {t("reg_terms_link")}
                </a>{" "}
                {t("reg_terms_and")}{" "}
                <a href="/confidentialite" target="_blank"
                  style={{ color: P, textDecoration: "none", fontWeight: 500 }}>
                  {t("reg_terms_privacy")}
                </a>
              </span>
            </label>

            <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
              style={{ background: loading ? "#F0C98A" : P, color: "#1A1000",
                border: "none", borderRadius: 9, padding: "13px 0",
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4, transition: "background 0.2s", fontFamily: "inherit" }}>
              {loading ? t("reg_loading") : t("reg_submit")}
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
    <div>
      <label style={lbl}>{label}</label>
      <div style={wrap}>
        <Icon size={14} color={MUTED} />
        <input value={value} onChange={e => onChange(e.target.value)}
          type={type} placeholder={placeholder} required={required}
          style={{ border: "none", background: "transparent", fontSize: 13,
            outline: "none", flex: 1, color: "#1E2E28", fontFamily: "inherit" }} />
      </div>
    </div>
  );
}

const lbl = {
  fontSize: 11, fontWeight: 500, color: "#6A7A72", display: "block", marginBottom: 6,
};
const wrap = {
  display: "flex", alignItems: "center", gap: 10,
  border: `0.5px solid #E4DFD8`, borderRadius: 9, padding: "11px 14px", background: "#F8F5EF",
};
