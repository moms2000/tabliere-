import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Calendar, MapPin, Users, ChevronRight, PartyPopper } from "lucide-react";
import { Card, PageTitle, Btn, Modal, FormField, Input, Toggle, Badge } from "../../components/ui";
import { eventsService } from "../../services/events.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.26 } } };

const STATUS = {
  brouillon: { label: "Brouillon", variant: "gray"   },
  publie:    { label: "Publié",    variant: "green"  },
  annule:    { label: "Annulé",    variant: "red"    },
  termine:   { label: "Terminé",   variant: "gray"   },
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function EventList() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", starts_at: "", venue_name: "", ville: "", description: "", is_public: true });

  const load = () => {
    setLoading(true);
    eventsService.listMine().then(d => setEvents(d?.events || [])).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const create = async () => {
    if (!form.name || !form.starts_at) return;
    setSaving(true);
    try {
      const { event } = await eventsService.create(form);
      setModal(false);
      navigate(`/event/${event.id}`);
    } catch (e) {
      alert(e.response?.data?.message || "Erreur lors de la création");
    } finally { setSaving(false); }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <PageTitle title="Mes événements" subtitle="Créez et gérez vos soirées et événements" />
        <Btn variant="primary" icon={Plus} onClick={() => { setForm({ name: "", starts_at: "", venue_name: "", ville: "", description: "", is_public: true }); setModal(true); }}>
          Créer
        </Btn>
      </motion.div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontSize: 13 }}>Chargement…</div>
      ) : events.length === 0 ? (
        <motion.div variants={fadeUp}>
          <Card>
            <div style={{ textAlign: "center", padding: "48px 0", color: MUTED }}>
              <PartyPopper size={34} color={BORDER} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: DARK, fontWeight: 600, marginBottom: 4 }}>Aucun événement</div>
              <div style={{ fontSize: 13, marginBottom: 18 }}>Créez votre premier événement pour commencer.</div>
              <Btn variant="primary" icon={Plus} onClick={() => setModal(true)} style={{ margin: "0 auto" }}>Créer un événement</Btn>
            </div>
          </Card>
        </motion.div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {events.map(e => {
            const st = STATUS[e.status] || STATUS.brouillon;
            return (
              <motion.div key={e.id} variants={fadeUp} whileHover={{ y: -2 }}
                onClick={() => navigate(`/event/${e.id}`)}
                style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 14,
                  overflow: "hidden", cursor: "pointer" }}>
                <div style={{ height: 84, background: e.cover_url ? `url(${e.cover_url}) center/cover` : `linear-gradient(135deg, ${DARK}, #2c4438)`,
                  position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 10 }}>
                  <Badge label={st.label} variant={st.variant} />
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 8,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                  <Row icon={Calendar} text={fmtDate(e.starts_at)} />
                  {(e.venue_name || e.ville) && <Row icon={MapPin} text={[e.venue_name, e.ville].filter(Boolean).join(" · ")} />}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${BG}` }}>
                    <span style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 5 }}>
                      <Users size={13} /> {e.resa_count || 0} résa · {e.tables_count || 0} tables
                    </span>
                    <ChevronRight size={16} color={P} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={modal} title="Nouvel événement" onClose={() => setModal(false)}>
        <FormField label="Nom de l'événement">
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Soirée Afro Vibes" />
        </FormField>
        <FormField label="Date & heure de début">
          <input type="datetime-local" value={form.starts_at} onChange={e => set("starts_at", e.target.value)}
            style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "10px 12px",
              fontSize: 13, background: BG, outline: "none", fontFamily: FONT, boxSizing: "border-box", color: DARK }} />
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Lieu (salle)"><Input value={form.venue_name} onChange={e => set("venue_name", e.target.value)} placeholder="Rooftop Cocody" /></FormField>
          <FormField label="Ville"><Input value={form.ville} onChange={e => set("ville", e.target.value)} placeholder="Abidjan" /></FormField>
        </div>
        <FormField label="Description (optionnel)">
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
            placeholder="Ambiance, line-up, dress code…"
            style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px",
              fontSize: 13, background: BG, outline: "none", fontFamily: FONT, resize: "vertical", boxSizing: "border-box", color: DARK }} />
        </FormField>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 6 }}>
          <Toggle value={form.is_public} onChange={v => set("is_public", v)} />
          <span style={{ fontSize: 13, color: DARK, fontFamily: FONT }}>
            {form.is_public ? "Événement public (visible dans la liste)" : "Événement privé (accès par lien uniquement)"}
          </span>
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn onClick={() => setModal(false)}>Annuler</Btn>
          <Btn variant="primary" onClick={create} disabled={!form.name || !form.starts_at || saving}>
            {saving ? "Création…" : "Créer"}
          </Btn>
        </div>
      </Modal>
    </motion.div>
  );
}

function Row({ icon: Icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, marginTop: 3 }}>
      <Icon size={12} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
}
