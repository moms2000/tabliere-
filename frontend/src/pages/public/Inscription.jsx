import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { UtensilsCrossed, Mail, Lock, User, Phone, Eye, EyeOff, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const G = "#1D9E75";

export default function Inscription() {
  const navigate    = useNavigate();
  const { register, login } = useAuth();
  const [step,    setStep]   = useState(1); // 1 = type, 2 = formulaire, 3 = succès
  const [type,    setType]   = useState("client"); // client | restaurateur
  const [showPw,  setShowPw] = useState(false);
  const [form,    setForm]   = useState({ nom: "", email: "", tel: "", password: "", resto: "" });
  const [error,   setError]  = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        full_name:       form.nom,
        email:           form.email,
        phone:           form.tel || undefined,
        password:        form.password,
        role:            type,
        restaurant_name: type === "restaurateur" ? form.resto : undefined,
      });
      try { await login(form.email, form.password); } catch (_) {}
      setStep(3);
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setError("Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.");
      } else if (status === 400) {
        setError(err.response?.data?.message || "Vérifiez les informations saisies.");
      } else {
        setError(err.response?.data?.message || "Une erreur est survenue. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 3) return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24 }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: "white", borderRadius: 16, padding: "44px 40px",
          border: "0.5px solid #eee", maxWidth: 400, width: "100%", textAlign: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,.07)" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#E1F5EE",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <CheckCircle size={30} color={G} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Compte créé !</h2>
        <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 24 }}>
          {type === "restaurateur"
            ? "Votre demande a été envoyée. Un manager vous contactera sous 24h via WhatsApp."
            : "Bienvenue sur TablièreCI. Vous pouvez maintenant réserver votre table."}
        </p>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => navigate(type === "restaurateur" ? "/restaurant" : "/")}
          style={{ background: G, color: "white", border: "none", borderRadius: 9,
            padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {type === "restaurateur" ? "Accéder à mon espace" : "Découvrir les restaurants"}
        </motion.button>
      </motion.div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>

      <div style={{ position: "absolute", top: 20, left: 24 }}>
        <button onClick={() => step === 1 ? navigate("/") : setStep(1)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", cursor: "pointer", fontSize: 13, color: "#888" }}>
          <ArrowLeft size={15} /> {step === 1 ? "Retour" : "Étape précédente"}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: "white", borderRadius: 16, padding: "36px 40px",
          border: "0.5px solid #eee", width: "100%", maxWidth: 440,
          boxShadow: "0 4px 24px rgba(0,0,0,.07)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: G,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UtensilsCrossed size={17} color="white" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 600, color: G }}>TablièreCI</span>
        </div>

        {step === 1 ? (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Créer un compte</h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 28 }}>Vous êtes ...</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "client",       title: "Je suis un client",       desc: "Je veux réserver des tables dans des restaurants" },
                { key: "restaurateur", title: "Je suis restaurateur",     desc: "Je veux gérer les réservations de mon restaurant" },
              ].map(o => (
                <motion.div key={o.key} whileHover={{ y: -1 }} onClick={() => { setType(o.key); setStep(2); }}
                  style={{ border: `1.5px solid ${type === o.key ? G : "#eee"}`,
                    borderRadius: 12, padding: "16px 18px", cursor: "pointer",
                    background: type === o.key ? "#E1F5EE" : "white" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3,
                    color: type === o.key ? G : "#1a1a1a" }}>{o.title}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{o.desc}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
              {type === "client" ? "Votre compte client" : "Votre restaurant"}
            </h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
              Étape 2 sur 2
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {error && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FEF2F2",
                  border: "0.5px solid #FECACA", borderRadius: 8, padding: "10px 13px" }}>
                  <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#DC2626", lineHeight: 1.4 }}>{error}</span>
                </div>
              )}
              <Field icon={User}  label="Nom complet"   type="text"     value={form.nom}      onChange={v => set("nom", v)}      placeholder="Ex : Fatou Amara" />
              <Field icon={Mail}  label="E-mail"        type="email"    value={form.email}    onChange={v => set("email", v)}    placeholder="vous@exemple.com" />
              <Field icon={Phone} label="WhatsApp"      type="tel"      value={form.tel}      onChange={v => set("tel", v)}      placeholder="+225 07 00 00 00 00" />
              {type === "restaurateur" && (
                <Field icon={UtensilsCrossed} label="Nom du restaurant" type="text" value={form.resto} onChange={v => set("resto", v)} placeholder="Ex : Le Maquis du Plateau" />
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#555",
                  display: "block", marginBottom: 6 }}>Mot de passe</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10,
                  border: "0.5px solid #ddd", borderRadius: 9, padding: "10px 13px" }}>
                  <Lock size={15} color="#bbb" />
                  <input value={form.password} onChange={e => set("password", e.target.value)}
                    type={showPw ? "text" : "password"} placeholder="8 caractères minimum" required
                    style={{ border: "none", background: "transparent", fontSize: 13,
                      outline: "none", flex: 1, color: "#333" }} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ background: "transparent", border: "none",
                      cursor: "pointer", color: "#bbb", display: "flex" }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                style={{ background: loading ? "#a0cfbe" : G, color: "white", border: "none",
                  borderRadius: 9, padding: "12px 0", fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer", marginTop: 4, transition: "background 0.2s" }}>
                {loading ? "Création en cours..." : "Créer mon compte"}
              </motion.button>
            </form>
          </>
        )}

        <p style={{ textAlign: "center", fontSize: 13, color: "#888", marginTop: 20 }}>
          Déjà inscrit ?{" "}
          <Link to="/connexion" style={{ color: G, fontWeight: 500, textDecoration: "none" }}>
            Se connecter
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

function Field({ icon: Icon, label, type, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#555",
        display: "block", marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10,
        border: "0.5px solid #ddd", borderRadius: 9, padding: "10px 13px" }}>
        <Icon size={15} color="#bbb" />
        <input value={value} onChange={e => onChange(e.target.value)}
          type={type} placeholder={placeholder} required
          style={{ border: "none", background: "transparent", fontSize: 13,
            outline: "none", flex: 1, color: "#333" }} />
      </div>
    </div>
  );
}
