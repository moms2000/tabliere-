/**
 * SiteParametres — Paramètres généraux du site TablièreCI
 * Informations de contact, textes légaux, branding, réseaux sociaux
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Globe, Mail, Phone, MapPin, Facebook, Instagram,
  FileText, Shield, Image, Palette, Save, CheckCircle,
} from "lucide-react";
import { Card, SectionHeader, PageTitle } from "../../components/ui";
import api from "../../services/api.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const P    = "#E8A045";
const DARK = "#1E2E28";
const MUTED = "#9BA89F";
const BG   = "#F8F5EF";
const BORDER = "#E4DFD8";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

function Field({ label, name, value, onChange, type = "text", multiline = false, placeholder = "" }) {
  const baseStyle = {
    width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
    padding: "10px 12px", fontSize: 13, outline: "none", background: BG,
    fontFamily: FONT, color: DARK, resize: multiline ? "vertical" : "none",
    boxSizing: "border-box",
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED,
        textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
        {label}
      </label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder} rows={6}
          style={{ ...baseStyle, minHeight: 120 }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder} style={baseStyle} />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <motion.div variants={fadeUp}>
      <Card style={{ marginBottom: 14 }}>
        <SectionHeader title={title} icon={Icon} />
        {children}
      </Card>
    </motion.div>
  );
}

export default function SiteParametres() {
  const [settings, setSettings] = useState({
    site_name:        "TablièreCI",
    contact_email:    "contact@tabliereci.net",
    contact_phone:    "+225 07 00 00 00 00",
    contact_address:  "Abidjan, Côte d'Ivoire",
    contact_whatsapp: "+225 07 00 00 00 00",
    facebook_url:     "",
    instagram_url:    "",
    logo_url:         "",
    banner_url:       "",
    primary_color:    "#E8A045",
    cgu_text:         "",
    privacy_text:     "",
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    api.get("/admin/settings")
      .then(r => {
        const s = r.data?.data?.settings || {};
        setSettings(prev => ({ ...prev, ...s }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setSettings(p => ({ ...p, [key]: val }));

  const save = async (keys) => {
    setSaving(true); setError(""); setSaved(false);
    try {
      const payload = keys
        ? Object.fromEntries(keys.map(k => [k, settings[k]]))
        : settings;
      await api.patch("/admin/settings", payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.message || "Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontFamily: FONT }}>
      Chargement des paramètres…
    </div>
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <PageTitle title="Paramètres du site" subtitle="Informations générales, légales et branding de TablièreCI" />
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => save()}
            disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 8, background: P,
              color: "#1A1000", border: "none", borderRadius: 10,
              padding: "10px 20px", fontSize: 13, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer", fontFamily: FONT,
              opacity: saving ? 0.7 : 1 }}>
            {saved ? <CheckCircle size={15} /> : <Save size={15} />}
            {saving ? "Sauvegarde…" : saved ? "Sauvegardé !" : "Tout sauvegarder"}
          </motion.button>
        </div>
        {error && (
          <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 9,
            padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 14 }}>
            {error}
          </div>
        )}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* ── Colonne gauche ── */}
        <div>
          {/* Contact */}
          <Section icon={Phone} title="Informations de contact">
            <Field label="Nom du site" name="site_name" value={settings.site_name}
              onChange={set} placeholder="TablièreCI" />
            <Field label="E-mail de contact" name="contact_email" value={settings.contact_email}
              onChange={set} type="email" placeholder="contact@tabliereci.net" />
            <Field label="Téléphone" name="contact_phone" value={settings.contact_phone}
              onChange={set} placeholder="+225 07 00 00 00 00" />
            <Field label="WhatsApp" name="contact_whatsapp" value={settings.contact_whatsapp}
              onChange={set} placeholder="+225 07 00 00 00 00" />
            <Field label="Adresse" name="contact_address" value={settings.contact_address}
              onChange={set} placeholder="Abidjan, Côte d'Ivoire" />
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => save(["site_name","contact_email","contact_phone","contact_whatsapp","contact_address"])}
              style={{ background: DARK, color: P, border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              Sauvegarder contact
            </motion.button>
          </Section>

          {/* Réseaux sociaux */}
          <Section icon={Globe} title="Réseaux sociaux">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Facebook size={16} color="#1877F2" />
              <input value={settings.facebook_url}
                onChange={e => set("facebook_url", e.target.value)}
                placeholder="https://facebook.com/tabliereci"
                style={{ flex: 1, border: `0.5px solid ${BORDER}`, borderRadius: 9,
                  padding: "9px 12px", fontSize: 13, outline: "none", background: BG, fontFamily: FONT }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Instagram size={16} color="#E4405F" />
              <input value={settings.instagram_url}
                onChange={e => set("instagram_url", e.target.value)}
                placeholder="https://instagram.com/tabliereci"
                style={{ flex: 1, border: `0.5px solid ${BORDER}`, borderRadius: 9,
                  padding: "9px 12px", fontSize: 13, outline: "none", background: BG, fontFamily: FONT }} />
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => save(["facebook_url","instagram_url"])}
              style={{ background: DARK, color: P, border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              Sauvegarder réseaux
            </motion.button>
          </Section>

          {/* Branding */}
          <Section icon={Palette} title="Branding & Images">
            <Field label="URL du logo" name="logo_url" value={settings.logo_url}
              onChange={set} placeholder="https://..." />
            <Field label="URL de la bannière d'accueil" name="banner_url" value={settings.banner_url}
              onChange={set} placeholder="https://..." />
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED,
                textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
                Couleur principale
              </label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="color" value={settings.primary_color}
                  onChange={e => set("primary_color", e.target.value)}
                  style={{ width: 48, height: 36, borderRadius: 6, border: `0.5px solid ${BORDER}`,
                    padding: 3, cursor: "pointer", background: BG }} />
                <span style={{ fontSize: 13, color: DARK, fontFamily: "monospace" }}>
                  {settings.primary_color}
                </span>
              </div>
            </div>
            {settings.logo_url && (
              <div style={{ marginBottom: 14, textAlign: "center", padding: 12,
                background: BG, borderRadius: 9, border: `0.5px solid ${BORDER}` }}>
                <img src={settings.logo_url} alt="Logo aperçu"
                  style={{ maxHeight: 60, objectFit: "contain" }}
                  onError={e => { e.target.style.display = "none"; }} />
              </div>
            )}
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => save(["logo_url","banner_url","primary_color"])}
              style={{ background: DARK, color: P, border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              Sauvegarder branding
            </motion.button>
          </Section>
        </div>

        {/* ── Colonne droite ── */}
        <div>
          {/* CGU */}
          <Section icon={FileText} title="Conditions Générales d'Utilisation (CGU)">
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 10, lineHeight: 1.6 }}>
              Ce texte s'affiche dans la modal CGU lors de l'inscription. Utilisez des retours à la ligne pour séparer les articles.
            </div>
            <Field label="Texte des CGU" name="cgu_text" value={settings.cgu_text}
              onChange={set} multiline placeholder="Article 1 — Objet&#10;TablièreCI est une plateforme...&#10;&#10;Article 2 — Inscription&#10;..." />
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => save(["cgu_text"])}
              style={{ background: DARK, color: P, border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              Sauvegarder CGU
            </motion.button>
          </Section>

          {/* Politique de confidentialité */}
          <Section icon={Shield} title="Politique de Confidentialité">
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 10, lineHeight: 1.6 }}>
              Ce texte s'affiche dans la modal Confidentialité lors de l'inscription.
            </div>
            <Field label="Texte de la politique" name="privacy_text" value={settings.privacy_text}
              onChange={set} multiline placeholder="1. Données collectées&#10;Nous collectons votre nom...&#10;&#10;2. Utilisation..." />
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => save(["privacy_text"])}
              style={{ background: DARK, color: P, border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              Sauvegarder politique
            </motion.button>
          </Section>

          {/* Aperçu rapide */}
          <motion.div variants={fadeUp}>
            <Card style={{ background: DARK }}>
              <SectionHeader title="Aperçu contact" icon={Mail} />
              {[
                { icon: Mail,   val: settings.contact_email   },
                { icon: Phone,  val: settings.contact_phone   },
                { icon: MapPin, val: settings.contact_address },
              ].map(({ icon: Icon, val }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Icon size={13} color="rgba(255,255,255,.4)" />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{val || "—"}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                {settings.facebook_url && (
                  <a href={settings.facebook_url} target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                      color: "#1877F2", textDecoration: "none", background: "rgba(255,255,255,.08)",
                      padding: "3px 8px", borderRadius: 6 }}>
                    <Facebook size={11} /> Facebook
                  </a>
                )}
                {settings.instagram_url && (
                  <a href={settings.instagram_url} target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                      color: "#E4405F", textDecoration: "none", background: "rgba(255,255,255,.08)",
                      padding: "3px 8px", borderRadius: 6 }}>
                    <Instagram size={11} /> Instagram
                  </a>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
