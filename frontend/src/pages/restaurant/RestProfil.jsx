import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Store, MapPin, Clock, Phone, Globe, DollarSign, Palette, Check, Camera, X, Images } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn, FormField, Input, PhotoUpload } from "../../components/ui";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const CUISINES = [
  "Africaine","Ivoirienne","Internationale","Française","Libanaise",
  "Asiatique","Fast-food","Grillades","Fruits de mer","Végétarienne",
];

const ZONES = ["Cocody","Plateau","Treichville","Yopougon","Marcory","Abobo","Adjamé","Bingerville","Port-Bouët","Grand-Bassam"];

export default function RestProfil() {
  const { user } = useAuth();
  const [resto,   setResto]   = useState(null);
  const [form,    setForm]    = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!user?.resto_id) { setLoading(false); return; }
    restaurantsService.getManage(user.resto_id)
      .then(d => {
        const r = d.restaurant || {};
        setResto(r);
        setForm({
          name:          r.name          || "",
          description:   r.description   || "",
          cuisine_type:  r.cuisine_type  || "",
          address:       r.address       || "",
          quartier:      r.quartier      || "",
          ville:         r.ville         || "Abidjan",
          phone:         r.phone         || "",
          email:         r.email         || "",
          website:       r.website       || "",
          opening_hours: r.opening_hours || "",
          price_range:   r.price_range   || "",
          capacity:      r.capacity      || "",
          theme_color:   r.theme_color   || P,
          logo_url:      r.logo_url      || "",
          photos:        Array.isArray(r.photos) ? r.photos : [],
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.resto_id]);

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target?.value ?? e }));

  const handleSave = async () => {
    if (!user?.resto_id) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const payload = { ...form };
      if (payload.capacity === "" || payload.capacity === undefined) {
        delete payload.capacity;
      } else {
        payload.capacity = Number(payload.capacity);
      }
      // Garder les optionnels même vides (null OK en DB)
      Object.keys(payload).forEach(k => {
        if (payload[k] === "") payload[k] = null;
      });
      await restaurantsService.update(user.resto_id, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: MUTED,
      fontSize: 13, fontFamily: FONT }}>Chargement…</div>
  );

  if (!resto) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: MUTED,
      fontSize: 14, fontFamily: FONT }}>
      Aucun restaurant associé à votre compte.
    </div>
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <PageTitle title="Profil du restaurant" subtitle="Informations visibles par vos clients" />
          <Btn variant="primary" icon={saved ? Check : Save} onClick={handleSave} disabled={saving}>
            {saving ? "Sauvegarde…" : saved ? "Enregistré !" : "Enregistrer"}
          </Btn>
        </div>
      </motion.div>

      {error && (
        <motion.div variants={fadeUp}
          style={{ marginBottom: 14, padding: "10px 14px", background: "#FAECE7",
            borderRadius: 10, fontSize: 13, color: "#993C1D", fontFamily: FONT }}>
          {error}
        </motion.div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14, alignItems: "start" }}>

        {/* Colonne principale */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Infos générales */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Informations générales" icon={Store} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Nom du restaurant">
                  <Input value={form.name} onChange={set("name")} placeholder="Le Maquis du Plateau" />
                </FormField>
                <FormField label="Type de cuisine">
                  <select value={form.cuisine_type} onChange={set("cuisine_type")}
                    style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
                      padding: "9px 12px", fontSize: 13, color: DARK, background: BG,
                      outline: "none", fontFamily: FONT, boxSizing: "border-box" }}>
                    <option value="">Sélectionner…</option>
                    {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Description">
                <textarea value={form.description} onChange={set("description")} rows={3}
                  placeholder="Décrivez votre restaurant, ambiance, spécialités…"
                  style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
                    padding: "9px 12px", fontSize: 13, color: DARK, background: BG,
                    outline: "none", fontFamily: FONT, resize: "vertical", boxSizing: "border-box" }} />
              </FormField>
            </Card>
          </motion.div>

          {/* Localisation */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Localisation" icon={MapPin} />
              <FormField label="Adresse complète">
                <Input value={form.address} onChange={set("address")} placeholder="Rue des Jardins, Cocody" />
              </FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Quartier / Zone">
                  <select value={form.quartier} onChange={set("quartier")}
                    style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
                      padding: "9px 12px", fontSize: 13, color: DARK, background: BG,
                      outline: "none", fontFamily: FONT, boxSizing: "border-box" }}>
                    <option value="">Sélectionner…</option>
                    {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </FormField>
                <FormField label="Ville">
                  <Input value={form.ville} onChange={set("ville")} placeholder="Abidjan" />
                </FormField>
              </div>
            </Card>
          </motion.div>

          {/* Contact & Horaires */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Contact & Horaires" icon={Phone} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Téléphone">
                  <Input value={form.phone} onChange={set("phone")} placeholder="+225 07 XX XX XX XX" type="tel" />
                </FormField>
                <FormField label="Email">
                  <Input value={form.email} onChange={set("email")} placeholder="contact@monresto.ci" type="email" />
                </FormField>
                <FormField label="Site web">
                  <Input value={form.website} onChange={set("website")} placeholder="https://monresto.ci" />
                </FormField>
                <FormField label="Horaires d'ouverture">
                  <Input value={form.opening_hours} onChange={set("opening_hours")} placeholder="Mar–Dim · 12h–14h30 · 19h–23h" />
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                    Ex : Lun–Sam 12h–15h · 18h30–23h · Fermé dimanche
                  </div>
                </FormField>
              </div>
            </Card>
          </motion.div>

          {/* Capacité & Prix */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Capacité & Tarifs" icon={DollarSign} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Capacité totale (couverts)">
                  <Input value={form.capacity} onChange={set("capacity")} type="number" placeholder="50" />
                </FormField>
                <FormField label="Prix moyen / personne">
                  <Input value={form.price_range} onChange={set("price_range")} placeholder="5 000 – 15 000 F" />
                </FormField>
              </div>
            </Card>
          </motion.div>

          {/* Disponibilités par taille de groupe */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Créneaux & Disponibilités" icon={DollarSign} />
              <div style={{ fontSize: 12, color: "#888", marginBottom: 12, lineHeight: 1.6 }}>
                Indiquez les horaires de service et le nombre de tables disponibles par taille de groupe.
                Ces informations aident les clients à trouver le bon créneau.
              </div>

              {/* Créneaux déjeuner / dîner */}
              <FormField label="Service déjeuner">
                <Input value={form.lunch_hours || ""}
                  onChange={e => setForm(p => ({ ...p, lunch_hours: e.target.value }))}
                  placeholder="12h00 – 14h30" />
              </FormField>
              <FormField label="Service dîner">
                <Input value={form.dinner_hours || ""}
                  onChange={e => setForm(p => ({ ...p, dinner_hours: e.target.value }))}
                  placeholder="19h00 – 23h00" />
              </FormField>

              {/* Tables par taille */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9BA89F",
                  textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
                  Nombre de tables disponibles
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Pour 1–2 personnes",  key: "tables_2" },
                    { label: "Pour 3–4 personnes",  key: "tables_4" },
                    { label: "Pour 5–6 personnes",  key: "tables_6" },
                    { label: "Pour 7+ personnes",   key: "tables_8" },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
                      <input
                        type="number" min={0} max={50}
                        value={form[key] || ""}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="0"
                        style={{ width: "100%", border: "0.5px solid #E4DFD8", borderRadius: 8,
                          padding: "8px 10px", fontSize: 13, outline: "none",
                          background: "#F8F5EF", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Colonne latérale */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Aperçu */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Aperçu" icon={Store} />
              <div style={{ background: form.theme_color + "22", borderRadius: 10,
                padding: "16px", textAlign: "center", marginBottom: 12 }}>
                <div style={{ width: 60, height: 60, borderRadius: 12,
                  background: form.theme_color, display: "flex", alignItems: "center",
                  justifyContent: "center", margin: "0 auto 10px" }}>
                  <Store size={28} color="white" />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>
                  {form.name || "Nom du restaurant"}
                </div>
                {form.cuisine_type && (
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{form.cuisine_type}</div>
                )}
                {form.quartier && (
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                    <MapPin size={10} style={{ verticalAlign: "middle" }} /> {form.quartier}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>
                Aperçu visible par les clients
              </div>
            </Card>
          </motion.div>

          {/* Couleur */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Couleur du thème" icon={Palette} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                {["#E8A045","#3D6B55","#1E2E28","#185FA5","#DC2626","#9333EA","#0F766E"].map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, theme_color: c }))}
                    style={{ width: 32, height: 32, borderRadius: 8, background: c, border: "none",
                      cursor: "pointer", outline: form.theme_color === c ? `3px solid ${DARK}` : "none",
                      outlineOffset: 2 }} />
                ))}
              </div>
              <FormField label="Code couleur (hex)">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={form.theme_color} onChange={set("theme_color")}
                    style={{ width: 36, height: 36, border: "none", borderRadius: 6,
                      cursor: "pointer", padding: 0, background: "transparent" }} />
                  <Input value={form.theme_color} onChange={set("theme_color")}
                    placeholder="#E8A045" style={{ flex: 1 }} />
                </div>
              </FormField>
            </Card>
          </motion.div>

          {/* Logo upload */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Logo du restaurant" icon={Globe} />
              <PhotoUpload
                label="Logo (depuis votre appareil)"
                value={form.logo_url}
                onChange={b64 => setForm(p => ({ ...p, logo_url: b64 }))}
                height={130}
              />
            </Card>
          </motion.div>

          {/* Photos du restaurant — jusqu'à 4 */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Photos du restaurant" icon={Images} />
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
                Ajoutez jusqu'à 4 photos pour présenter votre restaurant
                <span style={{ color: P, marginLeft: 6 }}>({(form.photos || []).length}/4)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[0, 1, 2, 3].map(idx => {
                  const existing = (form.photos || [])[idx];
                  return (
                    <div key={idx} style={{ position: "relative" }}>
                      {existing ? (
                        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden",
                          border: `0.5px solid ${BORDER}`, height: 110 }}>
                          <img src={existing} alt={`Photo ${idx + 1}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <button
                            onClick={() => {
                              const updated = [...(form.photos || [])];
                              updated.splice(idx, 1);
                              setForm(p => ({ ...p, photos: updated }));
                            }}
                            style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.6)",
                              border: "none", borderRadius: "50%", width: 22, height: 22,
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={11} color="white" />
                          </button>
                          <div style={{ position: "absolute", bottom: 4, left: 6,
                            fontSize: 9, background: "rgba(0,0,0,.5)", color: "white",
                            borderRadius: 4, padding: "1px 5px" }}>
                            Photo {idx + 1}
                          </div>
                        </div>
                      ) : (
                        <label style={{ display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          height: 110, borderRadius: 10, border: `1.5px dashed ${BORDER}`,
                          background: BG, cursor: (form.photos || []).length <= idx ? "pointer" : "default",
                          opacity: (form.photos || []).length < idx ? 0.4 : 1 }}>
                          <Camera size={20} color={MUTED} style={{ marginBottom: 6 }} />
                          <span style={{ fontSize: 11, color: MUTED }}>Photo {idx + 1}</span>
                          <input type="file" accept="image/*" style={{ display: "none" }}
                            disabled={(form.photos || []).length < idx}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => {
                                const img = new Image();
                                img.onload = () => {
                                  const MAX = 1000;
                                  let w = img.width, h = img.height;
                                  if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h*MAX/w); w = MAX; } else { w = Math.round(w*MAX/h); h = MAX; } }
                                  const canvas = document.createElement("canvas");
                                  canvas.width = w; canvas.height = h;
                                  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                                  const b64 = canvas.toDataURL("image/jpeg", 0.80);
                                  setForm(p => ({
                                    ...p,
                                    photos: [...(p.photos || []).slice(0, idx), b64, ...(p.photos || []).slice(idx + 1)].slice(0, 4)
                                  }));
                                };
                                img.src = ev.target.result;
                              };
                              reader.readAsDataURL(file);
                              e.target.value = "";
                            }} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
                Ces photos seront visibles sur la page de votre restaurant
              </div>
            </Card>
          </motion.div>

          {/* Slug */}
          <motion.div variants={fadeUp}>
            <Card>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>URL publique</div>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: DARK,
                background: BG, borderRadius: 8, padding: "8px 10px", wordBreak: "break-all" }}>
                tabliereci.net/restaurants/{resto.slug}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
