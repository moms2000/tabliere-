import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  UtensilsCrossed, Mail, Lock, User, Phone, Eye, EyeOff,
  ArrowLeft, CheckCircle, AlertCircle, Calendar, ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLang } from "../../context/LanguageContext.jsx";

const G = "#1D9E75";

// ── Indicatifs pays (50+ pays) ───────────────────────────────────────────────
// pattern = regex sur le numéro LOCAL (sans l'indicatif), placeholder = exemple local
const COUNTRIES = [
  // Afrique de l'Ouest
  { code: "CI", name: "Côte d'Ivoire",  dial: "+225", flag: "🇨🇮", pattern: /^\d{10}$/,      ph: "07 00 00 00 00" },
  { code: "SN", name: "Sénégal",        dial: "+221", flag: "🇸🇳", pattern: /^\d{9}$/,       ph: "77 000 00 00"  },
  { code: "ML", name: "Mali",           dial: "+223", flag: "🇲🇱", pattern: /^\d{8}$/,       ph: "70 00 00 00"   },
  { code: "BF", name: "Burkina Faso",   dial: "+226", flag: "🇧🇫", pattern: /^\d{8}$/,       ph: "70 00 00 00"   },
  { code: "GH", name: "Ghana",          dial: "+233", flag: "🇬🇭", pattern: /^\d{9}$/,       ph: "20 000 0000"   },
  { code: "NG", name: "Nigeria",        dial: "+234", flag: "🇳🇬", pattern: /^\d{10}$/,      ph: "802 000 0000"  },
  { code: "GN", name: "Guinée",         dial: "+224", flag: "🇬🇳", pattern: /^\d{9}$/,       ph: "622 00 00 00"  },
  { code: "CM", name: "Cameroun",       dial: "+237", flag: "🇨🇲", pattern: /^\d{9}$/,       ph: "670 00 00 00"  },
  { code: "TG", name: "Togo",           dial: "+228", flag: "🇹🇬", pattern: /^\d{8}$/,       ph: "90 00 00 00"   },
  { code: "BJ", name: "Bénin",          dial: "+229", flag: "🇧🇯", pattern: /^\d{8}$/,       ph: "90 00 00 00"   },
  { code: "NE", name: "Niger",          dial: "+227", flag: "🇳🇪", pattern: /^\d{8}$/,       ph: "90 00 00 00"   },
  { code: "LR", name: "Liberia",        dial: "+231", flag: "🇱🇷", pattern: /^\d{7,8}$/,     ph: "770 0000"      },
  { code: "SL", name: "Sierra Leone",   dial: "+232", flag: "🇸🇱", pattern: /^\d{8}$/,       ph: "76 000 000"    },
  { code: "GM", name: "Gambie",         dial: "+220", flag: "🇬🇲", pattern: /^\d{7}$/,       ph: "300 0000"      },
  // Afrique centrale & Est
  { code: "CD", name: "Congo (RDC)",    dial: "+243", flag: "🇨🇩", pattern: /^\d{9}$/,       ph: "81 000 0000"   },
  { code: "CG", name: "Congo (Brazza)", dial: "+242", flag: "🇨🇬", pattern: /^\d{9}$/,       ph: "06 000 0000"   },
  { code: "GA", name: "Gabon",          dial: "+241", flag: "🇬🇦", pattern: /^\d{7,8}$/,     ph: "060 00 00"     },
  { code: "KE", name: "Kenya",          dial: "+254", flag: "🇰🇪", pattern: /^\d{9}$/,       ph: "712 000 000"   },
  { code: "ET", name: "Éthiopie",       dial: "+251", flag: "🇪🇹", pattern: /^\d{9}$/,       ph: "91 100 0000"   },
  { code: "TZ", name: "Tanzanie",       dial: "+255", flag: "🇹🇿", pattern: /^\d{9}$/,       ph: "712 000 000"   },
  // Afrique du Nord
  { code: "MA", name: "Maroc",          dial: "+212", flag: "🇲🇦", pattern: /^\d{9}$/,       ph: "612 34 56 78"  },
  { code: "DZ", name: "Algérie",        dial: "+213", flag: "🇩🇿", pattern: /^\d{9}$/,       ph: "555 12 34 56"  },
  { code: "TN", name: "Tunisie",        dial: "+216", flag: "🇹🇳", pattern: /^\d{8}$/,       ph: "20 000 000"    },
  { code: "EG", name: "Égypte",         dial: "+20",  flag: "🇪🇬", pattern: /^\d{10}$/,      ph: "100 000 0000"  },
  // Europe
  { code: "FR", name: "France",         dial: "+33",  flag: "🇫🇷", pattern: /^[67]\d{8}$/,   ph: "6 12 34 56 78" },
  { code: "BE", name: "Belgique",       dial: "+32",  flag: "🇧🇪", pattern: /^[4]\d{8}$/,    ph: "470 00 00 00"  },
  { code: "CH", name: "Suisse",         dial: "+41",  flag: "🇨🇭", pattern: /^[78]\d{8}$/,   ph: "76 000 00 00"  },
  { code: "GB", name: "Royaume-Uni",    dial: "+44",  flag: "🇬🇧", pattern: /^[7]\d{9}$/,    ph: "7700 000000"   },
  { code: "DE", name: "Allemagne",      dial: "+49",  flag: "🇩🇪", pattern: /^\d{10,11}$/,   ph: "1512 3456789"  },
  { code: "ES", name: "Espagne",        dial: "+34",  flag: "🇪🇸", pattern: /^[67]\d{8}$/,   ph: "612 34 56 78"  },
  { code: "IT", name: "Italie",         dial: "+39",  flag: "🇮🇹", pattern: /^[3]\d{9}$/,    ph: "312 345 6789"  },
  { code: "PT", name: "Portugal",       dial: "+351", flag: "🇵🇹", pattern: /^9\d{8}$/,      ph: "912 345 678"   },
  { code: "NL", name: "Pays-Bas",       dial: "+31",  flag: "🇳🇱", pattern: /^6\d{8}$/,      ph: "6 12345678"    },
  { code: "SE", name: "Suède",          dial: "+46",  flag: "🇸🇪", pattern: /^7\d{8}$/,      ph: "70 000 00 00"  },
  { code: "NO", name: "Norvège",        dial: "+47",  flag: "🇳🇴", pattern: /^\d{8}$/,       ph: "400 00 000"    },
  // Amériques
  { code: "US", name: "États-Unis",     dial: "+1",   flag: "🇺🇸", pattern: /^\d{10}$/,      ph: "202 555 0100"  },
  { code: "CA", name: "Canada",         dial: "+1",   flag: "🇨🇦", pattern: /^\d{10}$/,      ph: "613 555 0100"  },
  { code: "BR", name: "Brésil",         dial: "+55",  flag: "🇧🇷", pattern: /^\d{10,11}$/,   ph: "11 91234 5678" },
  // Moyen-Orient
  { code: "SA", name: "Arabie Saoudite",dial: "+966", flag: "🇸🇦", pattern: /^5\d{8}$/,      ph: "50 000 0000"   },
  { code: "AE", name: "Émirats arabes", dial: "+971", flag: "🇦🇪", pattern: /^5\d{8}$/,      ph: "50 000 0000"   },
  { code: "LB", name: "Liban",          dial: "+961", flag: "🇱🇧", pattern: /^[37]\d{7}$/,   ph: "3 000 000"     },
  // Asie
  { code: "CN", name: "Chine",          dial: "+86",  flag: "🇨🇳", pattern: /^\d{11}$/,      ph: "131 0000 0000" },
  { code: "IN", name: "Inde",           dial: "+91",  flag: "🇮🇳", pattern: /^\d{10}$/,      ph: "91234 56789"   },
];

// ── Calcul force mot de passe ─────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_COLORS = ["", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#16A34A"];

export default function Inscription() {
  const navigate = useNavigate();
  const { register, login } = useAuth();
  const { t, lang } = useLang();
  const isRTL = lang === "ar";

  const [step,   setStep]   = useState(1);
  const [type,   setType]   = useState("client");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const [countryIdx, setCountryIdx] = useState(0); // index dans COUNTRIES
  const [showCountry, setShowCountry] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const [form, setForm] = useState({
    prenom: "", nom: "", email: "",
    date_naissance: "", localPhone: "",
    password: "", resto: "",
    terms: false,
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const country    = COUNTRIES[countryIdx];
  const strength   = getStrength(form.password);
  const fullPhone  = form.localPhone ? `${country.dial}${form.localPhone.replace(/\s/g, "")}` : "";
  const fullName   = `${form.prenom} ${form.nom}`.trim();

  // Filtrage recherche pays
  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!form.prenom || !form.nom) return t("err_bad_data");
    // Âge
    if (form.date_naissance) {
      const dob = new Date(form.date_naissance);
      const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 14) return t("err_age");
    } else {
      return t("err_bad_data");
    }
    // Téléphone
    if (form.localPhone) {
      const local = form.localPhone.replace(/\s/g, "");
      if (!country.pattern.test(local)) return t("err_phone_format");
    }
    // Mot de passe alphanumérique
    if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password) || form.password.length < 8) {
      return t("err_password_weak");
    }
    // CGU
    if (!form.terms) return t("err_terms");
    return null;
  };

  // ── Soumission ────────────────────────────────────────────────────────────
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

  // ── Succès ────────────────────────────────────────────────────────────────
  if (step === 3) return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, direction: isRTL ? "rtl" : "ltr" }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: "white", borderRadius: 16, padding: "44px 40px",
          border: "0.5px solid #eee", maxWidth: 400, width: "100%", textAlign: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,.07)" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#E1F5EE",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <CheckCircle size={30} color={G} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{t("reg_success_title")}</h2>
        <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 24 }}>
          {type === "restaurateur" ? t("reg_success_resto") : t("reg_success_client")}
        </p>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => navigate(type === "restaurateur" ? "/restaurant" : "/")}
          style={{ background: G, color: "white", border: "none", borderRadius: 9,
            padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {type === "restaurateur" ? t("reg_success_resto_btn") : t("reg_success_client_btn")}
        </motion.button>
      </motion.div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
      padding: "24px 24px 60px", direction: isRTL ? "rtl" : "ltr" }}>

      <div style={{ position: "fixed", top: 20, [isRTL ? "right" : "left"]: 24 }}>
        <button onClick={() => step === 1 ? navigate("/") : setStep(1)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", cursor: "pointer", fontSize: 13, color: "#888" }}>
          <ArrowLeft size={15} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
          {step === 1 ? t("reg_back") : t("reg_prev")}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: "white", borderRadius: 16, padding: "36px 40px",
          border: "0.5px solid #eee", width: "100%", maxWidth: 480, marginTop: 50,
          boxShadow: "0 4px 24px rgba(0,0,0,.07)" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: G,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UtensilsCrossed size={17} color="white" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 600, color: G }}>TablièreCI</span>
        </div>

        {/* ── Étape 1 : choix du type ─────────────────────────────────── */}
        {step === 1 ? (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("reg_title")}</h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 28 }}>{t("reg_subtitle")}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "client",       titleK: "reg_client_title", descK: "reg_client_desc" },
                { key: "restaurateur", titleK: "reg_resto_title",  descK: "reg_resto_desc"  },
              ].map(o => (
                <motion.div key={o.key} whileHover={{ y: -1 }}
                  onClick={() => { setType(o.key); setStep(2); }}
                  style={{ border: `1.5px solid ${type === o.key ? G : "#eee"}`,
                    borderRadius: 12, padding: "16px 18px", cursor: "pointer",
                    background: type === o.key ? "#E1F5EE" : "white" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3,
                    color: type === o.key ? G : "#1a1a1a" }}>{t(o.titleK)}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{t(o.descK)}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>
              {type === "client" ? t("reg_step2_client") : t("reg_step2_resto")}
            </h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 22 }}>{t("reg_step_of")}</p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>

              {/* Erreur */}
              {error && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
                  background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 8, padding: "10px 13px" }}>
                  <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#DC2626", lineHeight: 1.4 }}>{error}</span>
                </div>
              )}

              {/* Prénom + Nom sur 2 colonnes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field icon={User} label={t("reg_firstname")} type="text"
                  value={form.prenom} onChange={v => set("prenom", v)}
                  placeholder="Fatou" required />
                <Field icon={User} label={t("reg_lastname")} type="text"
                  value={form.nom} onChange={v => set("nom", v)}
                  placeholder="Amara" required />
              </div>

              {/* Email */}
              <Field icon={Mail} label={t("reg_email")} type="email"
                value={form.email} onChange={v => set("email", v)}
                placeholder="vous@exemple.com" required />

              {/* Date de naissance */}
              <div>
                <label style={labelStyle}>{t("reg_dob")}</label>
                <div style={inputWrap}>
                  <Calendar size={15} color="#bbb" />
                  <input type="date" value={form.date_naissance}
                    onChange={e => set("date_naissance", e.target.value)}
                    max={new Date(Date.now() - 14 * 365.25 * 86400000).toISOString().split("T")[0]}
                    required
                    style={{ border: "none", background: "transparent", fontSize: 13,
                      outline: "none", flex: 1, color: form.date_naissance ? "#333" : "#bbb" }} />
                </div>
              </div>

              {/* Indicatif + téléphone */}
              <div>
                <label style={labelStyle}>{t("reg_phone")}</label>
                <div style={{ display: "flex", gap: 8 }}>

                  {/* Sélecteur pays */}
                  <div style={{ position: "relative" }}>
                    <button type="button" onClick={() => setShowCountry(p => !p)}
                      style={{ display: "flex", alignItems: "center", gap: 6,
                        border: "0.5px solid #ddd", borderRadius: 9, padding: "10px 10px",
                        background: "white", cursor: "pointer", fontSize: 13,
                        whiteSpace: "nowrap", color: "#333", height: "100%" }}>
                      {country.flag} {country.dial}
                      <ChevronDown size={12} color="#bbb" />
                    </button>

                    {showCountry && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)",
                        left: 0, zIndex: 50, background: "white", border: "0.5px solid #eee",
                        borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,.12)",
                        width: 260, maxHeight: 280, overflow: "hidden",
                        display: "flex", flexDirection: "column" }}>
                        <div style={{ padding: "8px 10px", borderBottom: "0.5px solid #f0f0f0" }}>
                          <input autoFocus placeholder="Rechercher un pays..."
                            value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                            style={{ width: "100%", border: "0.5px solid #eee", borderRadius: 7,
                              padding: "6px 10px", fontSize: 13, outline: "none", color: "#333" }} />
                        </div>
                        <div style={{ overflowY: "auto", flex: 1 }}>
                          {filteredCountries.map((c, i) => {
                            const idx = COUNTRIES.indexOf(c);
                            return (
                              <button key={c.code + i} type="button"
                                onClick={() => { setCountryIdx(idx); setShowCountry(false); setCountrySearch(""); }}
                                style={{ display: "flex", alignItems: "center", gap: 8,
                                  width: "100%", padding: "8px 12px", border: "none",
                                  background: idx === countryIdx ? "#E1F5EE" : "white",
                                  cursor: "pointer", fontSize: 13, color: "#333", textAlign: "left" }}>
                                {c.flag} <span style={{ flex: 1 }}>{c.name}</span>
                                <span style={{ color: "#999", fontSize: 12 }}>{c.dial}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Numéro local */}
                  <div style={{ ...inputWrap, flex: 1 }}>
                    <Phone size={15} color="#bbb" />
                    <input type="tel" value={form.localPhone}
                      onChange={e => set("localPhone", e.target.value)}
                      placeholder={country.ph}
                      style={{ border: "none", background: "transparent", fontSize: 13,
                        outline: "none", flex: 1, color: "#333" }} />
                  </div>
                </div>
              </div>

              {/* Nom du restaurant (restaurateur uniquement) */}
              {type === "restaurateur" && (
                <Field icon={UtensilsCrossed} label={t("reg_resto_name")} type="text"
                  value={form.resto} onChange={v => set("resto", v)}
                  placeholder="Le Maquis du Plateau" required />
              )}

              {/* Mot de passe + indicateur de force */}
              <div>
                <label style={labelStyle}>{t("reg_password")}</label>
                <div style={inputWrap}>
                  <Lock size={15} color="#bbb" />
                  <input value={form.password} onChange={e => set("password", e.target.value)}
                    type={showPw ? "text" : "password"}
                    placeholder={t("reg_pw_placeholder")} required
                    style={{ border: "none", background: "transparent", fontSize: 13,
                      outline: "none", flex: 1, color: "#333" }} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ background: "transparent", border: "none",
                      cursor: "pointer", color: "#bbb", display: "flex", padding: 0 }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Barre de force */}
                {form.password && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
                          background: i <= strength ? STRENGTH_COLORS[strength] : "#eee",
                          transition: "background 0.2s" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: STRENGTH_COLORS[strength], fontWeight: 500 }}>
                      {t(`pw_strength_${strength}`)}
                    </div>
                  </div>
                )}
              </div>

              {/* CGU */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10,
                fontSize: 13, color: "#555", cursor: "pointer", lineHeight: 1.5 }}>
                <input type="checkbox" checked={form.terms}
                  onChange={e => set("terms", e.target.checked)}
                  style={{ accentColor: G, marginTop: 2, flexShrink: 0 }} />
                <span>
                  {t("reg_terms")}{" "}
                  <a href="/cgu" target="_blank"
                    style={{ color: G, textDecoration: "none", fontWeight: 500 }}>
                    {t("reg_terms_link")}
                  </a>{" "}
                  {t("reg_terms_and")}{" "}
                  <a href="/confidentialite" target="_blank"
                    style={{ color: G, textDecoration: "none", fontWeight: 500 }}>
                    {t("reg_terms_privacy")}
                  </a>
                </span>
              </label>

              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                style={{ background: loading ? "#a0cfbe" : G, color: "white", border: "none",
                  borderRadius: 9, padding: "12px 0", fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer", marginTop: 4, transition: "background 0.2s" }}>
                {loading ? t("reg_loading") : t("reg_submit")}
              </motion.button>
            </form>
          </>
        )}

        <p style={{ textAlign: "center", fontSize: 13, color: "#888", marginTop: 20 }}>
          {t("reg_already")}{" "}
          <Link to="/connexion" style={{ color: G, fontWeight: 500, textDecoration: "none" }}>
            {t("reg_login")}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

// ── Composant champ ───────────────────────────────────────────────────────────
function Field({ icon: Icon, label, type, value, onChange, placeholder, required }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={inputWrap}>
        <Icon size={15} color="#bbb" />
        <input value={value} onChange={e => onChange(e.target.value)}
          type={type} placeholder={placeholder} required={required}
          style={{ border: "none", background: "transparent", fontSize: 13,
            outline: "none", flex: 1, color: "#333" }} />
      </div>
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
