import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ExternalLink, Save, Plus, Pencil, Trash2, Check, X,
  Crown, Armchair, Calendar, Users, Phone, Copy, CheckCheck,
} from "lucide-react";
import { Card, Btn, Modal, FormField, Input, Toggle, Badge, PhotoUpload } from "../../components/ui";
import { eventsService, eventReservationsService } from "../../services/events.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "Gratuit";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const toLocalInput = (d) => { if (!d) return ""; const dt = new Date(d); const off = dt.getTimezoneOffset(); return new Date(dt - off * 60000).toISOString().slice(0, 16); };

const RESA_STATUS = {
  en_attente: { label: "En attente", variant: "amber" },
  confirme:   { label: "Confirmée",  variant: "green" },
  annule:     { label: "Annulée",    variant: "red"   },
  termine:    { label: "Terminée",   variant: "gray"  },
};

export default function EventEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("details");
  const [event, setEvent] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    eventsService.getManage(id)
      .then(d => { setEvent(d.event); setTables(d.tables || []); })
      .catch(() => navigate("/event"))
      .finally(() => setLoading(false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontFamily: FONT }}>Chargement…</div>;
  if (!event) return null;

  const publicUrl = `${window.location.origin}/evenement/${event.slug}`;
  const st = { brouillon: ["Brouillon", "gray"], publie: ["Publié", "green"], annule: ["Annulé", "red"], termine: ["Terminé", "gray"] }[event.status] || ["Brouillon", "gray"];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ fontFamily: FONT }}>
      {/* Header */}
      <button onClick={() => navigate("/event")}
        style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent",
          color: MUTED, cursor: "pointer", fontSize: 13, marginBottom: 12, padding: 0, fontFamily: FONT }}>
        <ArrowLeft size={15} /> Mes événements
      </button>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: DARK, margin: 0 }}>{event.name}</h1>
            <Badge label={st[0]} variant={st[1]} />
          </div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>{fmtDate(event.starts_at)}</div>
        </div>
        {event.status === "publie" && (
          <Btn icon={ExternalLink} onClick={() => window.open(publicUrl, "_blank")}>Voir la page</Btn>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `0.5px solid ${BORDER}` }}>
        {[["details", "Détails"], ["plan", `Plan & Tables${tables.length ? " · " + tables.length : ""}`], ["resa", "Réservations"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: FONT,
              padding: "10px 14px", fontSize: 13.5, fontWeight: tab === k ? 700 : 500,
              color: tab === k ? DARK : MUTED, borderBottom: tab === k ? `2px solid ${P}` : "2px solid transparent",
              marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "details" && <DetailsTab event={event} onSaved={load} publicUrl={publicUrl} />}
      {tab === "plan"    && <PlanTab event={event} tables={tables} onChanged={load} />}
      {tab === "resa"    && <ResaTab eventId={event.id} />}
    </motion.div>
  );
}

// ── Détails ──────────────────────────────────────────────────────────────────
function DetailsTab({ event, onSaved, publicUrl }) {
  const [f, setF] = useState({
    name: event.name || "", description: event.description || "",
    venue_name: event.venue_name || "", address: event.address || "",
    ville: event.ville || "", quartier: event.quartier || "",
    starts_at: toLocalInput(event.starts_at), ends_at: toLocalInput(event.ends_at),
    cover_url: event.cover_url || "", is_public: event.is_public !== false,
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await eventsService.update(event.id, f); await onSaved(); }
    catch (e) { alert(e.response?.data?.message || "Erreur"); }
    finally { setSaving(false); }
  };
  const setStatus = async (status) => {
    const msg = status === "publie" ? "Publier cet événement ? Il deviendra visible et réservable."
      : status === "brouillon" ? "Repasser en brouillon ? Il ne sera plus visible publiquement."
      : "Annuler cet événement ?";
    if (!window.confirm(msg)) return;
    try { await eventsService.update(event.id, { status }); await onSaved(); }
    catch (e) { alert(e.response?.data?.message || "Erreur"); }
  };
  const copy = () => { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Statut / publication */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK, marginBottom: 2 }}>Publication</div>
            <div style={{ fontSize: 12, color: MUTED }}>
              {event.status === "publie" ? "Votre événement est en ligne et accepte les réservations." : "Publiez pour rendre l'événement visible et réservable."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {event.status !== "publie" && <Btn variant="primary" onClick={() => setStatus("publie")}>Publier</Btn>}
            {event.status === "publie" && <Btn onClick={() => setStatus("brouillon")}>Dépublier</Btn>}
            {event.status !== "annule" && <Btn onClick={() => setStatus("annule")}>Annuler</Btn>}
          </div>
        </div>
        {event.status === "publie" && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: BG, borderRadius: 9, padding: "8px 12px" }}>
            <code style={{ fontSize: 12, color: DARK, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{publicUrl}</code>
            <button onClick={copy} style={{ border: "none", background: "transparent", cursor: "pointer", color: copied ? GREEN : MUTED, display: "flex" }}>
              {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
            </button>
          </div>
        )}
      </Card>

      {/* Infos */}
      <Card>
        <PhotoUpload label="Affiche / couverture" type="event" value={f.cover_url} onChange={url => set("cover_url", url)} height={130} />
        <FormField label="Nom de l'événement"><Input value={f.name} onChange={e => set("name", e.target.value)} /></FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Début">
            <input type="datetime-local" value={f.starts_at} onChange={e => set("starts_at", e.target.value)} style={dateInp} />
          </FormField>
          <FormField label="Fin (optionnel)">
            <input type="datetime-local" value={f.ends_at} onChange={e => set("ends_at", e.target.value)} style={dateInp} />
          </FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Lieu (salle)"><Input value={f.venue_name} onChange={e => set("venue_name", e.target.value)} placeholder="Rooftop Cocody" /></FormField>
          <FormField label="Ville"><Input value={f.ville} onChange={e => set("ville", e.target.value)} placeholder="Abidjan" /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Quartier"><Input value={f.quartier} onChange={e => set("quartier", e.target.value)} placeholder="Cocody" /></FormField>
          <FormField label="Adresse"><Input value={f.address} onChange={e => set("address", e.target.value)} placeholder="Rue des Jardins" /></FormField>
        </div>
        <FormField label="Description">
          <textarea value={f.description} onChange={e => set("description", e.target.value)} rows={3}
            placeholder="Ambiance, line-up, dress code…"
            style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px",
              fontSize: 13, background: BG, outline: "none", fontFamily: FONT, resize: "vertical", boxSizing: "border-box", color: DARK }} />
        </FormField>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 4 }}>
          <Toggle value={f.is_public} onChange={v => set("is_public", v)} />
          <span style={{ fontSize: 13, color: DARK }}>{f.is_public ? "Public (visible dans la liste des événements)" : "Privé (accès par lien uniquement)"}</span>
        </label>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="primary" icon={Save} onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── Plan & Tables ────────────────────────────────────────────────────────────
function PlanTab({ event, tables, onChanged }) {
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState({ label: "", kind: "simple", capacity: 4, price: 0, description: "", zone: "general" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const openNew = () => { setEdit(null); setF({ label: "", kind: "simple", capacity: 4, price: 0, description: "", zone: "general" }); setModal(true); };
  const openEdit = (t) => { setEdit(t); setF({ label: t.label, kind: t.kind, capacity: t.capacity, price: t.price, description: t.description || "", zone: t.zone || "general" }); setModal(true); };

  const save = async () => {
    if (!f.label) return;
    setSaving(true);
    try {
      const payload = { ...f, capacity: Number(f.capacity) || 1, price: Number(f.price) || 0 };
      if (edit) await eventsService.updateTable(event.id, edit.id, payload);
      else await eventsService.createTable(event.id, payload);
      setModal(false); await onChanged();
    } catch (e) { alert(e.response?.data?.message || "Erreur"); }
    finally { setSaving(false); }
  };
  const del = async (t) => {
    if (!window.confirm(`Retirer « ${t.label} » ?`)) return;
    try { await eventsService.deleteTable(event.id, t.id); await onChanged(); } catch (e) { alert("Erreur"); }
  };

  const vip = tables.filter(t => t.kind === "vip");
  const simple = tables.filter(t => t.kind !== "vip");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>Tables & Packs VIP</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Ce que vos invités pourront réserver (cash sur place).</div>
          </div>
          <Btn variant="primary" icon={Plus} onClick={openNew}>Ajouter</Btn>
        </div>
      </Card>

      {tables.length === 0 ? (
        <Card><div style={{ textAlign: "center", padding: "38px 0", color: MUTED, fontSize: 13 }}>
          Aucune table. Ajoutez des tables simples et des packs VIP à réserver.
        </div></Card>
      ) : (
        <>
          {vip.length > 0 && <TableGroup title="Packs VIP" icon={Crown} items={vip} onEdit={openEdit} onDel={del} />}
          {simple.length > 0 && <TableGroup title="Tables" icon={Armchair} items={simple} onEdit={openEdit} onDel={del} />}
        </>
      )}

      <Modal open={modal} title={edit ? "Modifier" : "Nouvelle table / pack VIP"} onClose={() => setModal(false)}>
        <FormField label="Type">
          <div style={{ display: "flex", gap: 8 }}>
            {[["simple", "Table simple", Armchair], ["vip", "Pack VIP", Crown]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => set("kind", k)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  border: `1.5px solid ${f.kind === k ? P : BORDER}`, borderRadius: 10, padding: "10px 0",
                  background: f.kind === k ? "#FEF6EC" : "white", cursor: "pointer", fontFamily: FONT,
                  color: f.kind === k ? "#C47D1A" : DARK, fontSize: 13, fontWeight: 600 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Libellé"><Input value={f.label} onChange={e => set("label", e.target.value)} placeholder={f.kind === "vip" ? "Carré VIP 1" : "Table 1"} /></FormField>
          <FormField label="Capacité (pers.)"><Input type="number" value={f.capacity} onChange={e => set("capacity", e.target.value)} placeholder="4" /></FormField>
        </div>
        <FormField label={f.kind === "vip" ? "Prix du pack (FCFA)" : "Prix (FCFA, 0 = gratuit)"}>
          <Input type="number" value={f.price} onChange={e => set("price", e.target.value)} placeholder={f.kind === "vip" ? "150000" : "0"} />
        </FormField>
        {f.kind === "vip" && (
          <FormField label="Contenu du pack (optionnel)">
            <textarea value={f.description} onChange={e => set("description", e.target.value)} rows={2}
              placeholder="1 bouteille offerte, service dédié, table réservée…"
              style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px",
                fontSize: 13, background: BG, outline: "none", fontFamily: FONT, resize: "vertical", boxSizing: "border-box", color: DARK }} />
          </FormField>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn onClick={() => setModal(false)}>Annuler</Btn>
          <Btn variant="primary" onClick={save} disabled={!f.label || saving}>{saving ? "…" : edit ? "Enregistrer" : "Ajouter"}</Btn>
        </div>
      </Modal>
    </div>
  );
}

function TableGroup({ title, icon: Icon, items, onEdit, onDel }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <Icon size={16} color={P} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: DARK }}>{title}</span>
        <span style={{ fontSize: 12, color: MUTED }}>· {items.length}</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
            border: `0.5px solid ${BORDER}`, borderRadius: 10, background: t.status === "reserve" ? "#FEF6E4" : "white" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{t.label}</div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>
                {t.capacity} pers. · {fmt(t.price)}{t.status === "reserve" ? " · Réservée" : ""}
              </div>
              {t.description && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{t.description}</div>}
            </div>
            <button onClick={() => onEdit(t)} style={iconBtn}><Pencil size={14} color={MUTED} /></button>
            <button onClick={() => onDel(t)} style={iconBtn}><Trash2 size={14} color="#DC2626" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Réservations ─────────────────────────────────────────────────────────────
function ResaTab({ eventId }) {
  const [resas, setResas] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => eventReservationsService.listForEvent(eventId).then(d => setResas(d?.reservations || [])).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId]);

  const act = async (id, kind) => {
    try { kind === "confirm" ? await eventReservationsService.confirm(id) : await eventReservationsService.cancel(id); load(); }
    catch (e) { alert("Erreur"); }
  };

  if (loading) return <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>Chargement…</div>;
  if (!resas.length) return <Card><div style={{ textAlign: "center", padding: "38px 0", color: MUTED, fontSize: 13 }}>Aucune réservation pour le moment.</div></Card>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {resas.map(r => {
        const st = RESA_STATUS[r.status] || RESA_STATUS.en_attente;
        return (
          <Card key={r.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{r.client_name || r.guest_name || "Client"}</span>
                  <Badge label={st.label} variant={st.variant} />
                  <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{r.ref}</span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={12} /> {r.party_size} pers.</span>
                  {r.table_label && <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {r.table_kind === "vip" ? <Crown size={12} color={P} /> : <Armchair size={12} />} {r.table_label}{r.table_price ? ` · ${fmt(r.table_price)}` : ""}
                  </span>}
                  {(r.client_phone || r.guest_phone) && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {r.client_phone || r.guest_phone}</span>}
                </div>
                {r.special_request && <div style={{ fontSize: 12, color: MUTED, marginTop: 4, fontStyle: "italic" }}>« {r.special_request} »</div>}
              </div>
              {r.status !== "annule" && (
                <div style={{ display: "flex", gap: 8 }}>
                  {r.status !== "confirme" && (
                    <button onClick={() => act(r.id, "confirm")}
                      style={{ display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 8,
                        padding: "7px 12px", background: GREEN, color: "white", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                      <Check size={14} /> Confirmer
                    </button>
                  )}
                  <button onClick={() => act(r.id, "cancel")}
                    style={{ display: "flex", alignItems: "center", gap: 5, border: `0.5px solid ${BORDER}`, borderRadius: 8,
                      padding: "7px 12px", background: "white", color: "#DC2626", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    <X size={14} /> Annuler
                  </button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const dateInp = { width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, background: BG, outline: "none", fontFamily: FONT, boxSizing: "border-box", color: DARK };
const iconBtn = { border: "none", background: "transparent", cursor: "pointer", padding: 4, display: "flex" };
