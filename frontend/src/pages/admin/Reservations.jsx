import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Search, Users, Pencil, Check, X } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Table, DateFilter, Btn, Modal, FormField, Input, Select } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

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

const STATUS_BADGE = {
  confirme: "green", en_attente: "amber", annule: "red",
  confirmé: "green", "en attente": "amber", annulé: "red",
};

const fmt     = (n)  => n ? Number(n).toLocaleString("fr-FR") + " F" : "—";
const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
  : "—";

/* ── Cellule éditable inline ─────────────────────────────────────────────────── */
function EditableCell({ value, onSave, type = "text" }) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(value);
  if (!editing) return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 13 }}>{value || "—"}</span>
      <button onClick={() => setEditing(true)}
        style={{ border: "none", background: "transparent",
          cursor: "pointer", color: MUTED, display: "flex", padding: 2 }}>
        <Pencil size={11} />
      </button>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input value={val} type={type} onChange={e => setVal(e.target.value)}
        style={{ border: `0.5px solid ${P}`, borderRadius: 6, padding: "2px 7px",
          fontSize: 12, color: DARK, background: PL, outline: "none",
          fontFamily: FONT, width: type === "number" ? 50 : 120 }} />
      <button onClick={() => { onSave(val); setEditing(false); }}
        style={{ border: "none", background: "transparent", cursor: "pointer",
          color: S, display: "flex", padding: 2 }}>
        <Check size={12} />
      </button>
      <button onClick={() => { setVal(value); setEditing(false); }}
        style={{ border: "none", background: "transparent", cursor: "pointer",
          color: MUTED, display: "flex", padding: 2 }}>
        <X size={12} />
      </button>
    </div>
  );
}

export default function Reservations() {
  const [data,     setData]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("tous");
  const [dateMode, setDateMode] = useState("Mois");
  const [editModal, setEditModal] = useState(null);
  const [editForm,  setEditForm]  = useState({});

  useEffect(() => {
    const params = { limit: 200 };
    if (filter !== "tous") params.status = filter;
    adminService.listReservations(params)
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const filterByDate = (items) => {
    const now = new Date();
    return items.filter(r => {
      if (!r.reserved_at) return true;
      const d = new Date(r.reserved_at);
      if (dateMode === "Jour")  return d.toDateString() === now.toDateString();
      if (dateMode === "Mois")  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (dateMode === "Année") return d.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const updateInline = async (id, fields) => {
    try {
      await adminService.updateReservation?.(id, fields).catch(() => null);
      setData(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    } catch (e) { console.error(e); }
  };

  const openEdit = (r) => {
    setEditModal(r);
    setEditForm({
      party_size:  r.party_size,
      reserved_at: r.reserved_at?.slice(0,16) || "",
      status:      r.status,
      notes:       r.notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editModal) return;
    await updateInline(editModal.id, { ...editForm, party_size: Number(editForm.party_size) });
    setEditModal(null);
  };

  const baseFiltered = filterByDate(
    search ? data.filter(r =>
      (r.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.resto_name  || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.ref         || "").toLowerCase().includes(search.toLowerCase())
    ) : data
  );

  const cols = [
    { key: "ref",    label: "Réf",        render: r => <span style={{ fontFamily: "monospace", fontSize: 11, color: MUTED }}>{r.ref}</span> },
    { key: "client", label: "Client",     render: r => <span style={{ fontWeight: 500, fontSize: 13 }}>{r.client_name || "—"}</span> },
    { key: "resto",  label: "Restaurant", render: r => <span style={{ fontSize: 12, color: MUTED }}>{r.resto_name || "—"}</span> },
    { key: "date",   label: "Date & Heure", render: r => (
      <EditableCell value={fmtDate(r.reserved_at)} type="datetime-local"
        onSave={v => updateInline(r.id, { reserved_at: v })} />
    )},
    { key: "pers",   label: "Pers.", align: "center", render: r => (
      <EditableCell value={r.party_size} type="number"
        onSave={v => updateInline(r.id, { party_size: Number(v) })} />
    )},
    { key: "montant",label: "Arrhes", align: "right", render: r => <span style={{ fontWeight: 500 }}>{fmt(r.arrhes_amount)}</span> },
    { key: "status", label: "Statut", render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /> },
    { key: "edit",   label: "",       align: "right", render: r => (
      <button onClick={() => openEdit(r)}
        style={{ border: `0.5px solid ${BORDER}`, borderRadius: 7, padding: "4px 10px",
          background: "white", cursor: "pointer", color: MUTED, fontSize: 11,
          display: "flex", alignItems: "center", gap: 4, fontFamily: FONT }}>
        <Pencil size={11} /> Modifier
      </button>
    )},
  ];

  const byStatus = (s) => data.filter(r => [s, s.replace(/_/g," ")].includes(r.status)).length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <PageTitle title="Réservations" subtitle="Toutes les réservations de la plateforme" />
          <DateFilter value={dateMode} onChange={setDateMode} />
        </div>
      </motion.div>

      {/* Compteurs */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Total",       val: total,           color: DARK },
          { label: "Confirmées",  val: byStatus("confirme"), color: S },
          { label: "En attente",  val: byStatus("en_attente"), color: "#C47D1A" },
          { label: "Annulées",    val: byStatus("annule"), color: "#DC2626" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 100, background: "white",
            border: `0.5px solid ${BORDER}`, borderRadius: 12,
            padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: MUTED }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <SectionHeader title="Historique" icon={CalendarCheck} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["tous","confirme","en_attente","annule"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, cursor: "pointer",
                    border: `0.5px solid ${filter === f ? P : BORDER}`,
                    background: filter === f ? PL : "white",
                    color: filter === f ? "#C47D1A" : MUTED,
                    fontWeight: filter === f ? 600 : 400, fontFamily: FONT,
                    textTransform: "capitalize" }}>
                  {f.replace("_"," ")}
                </button>
              ))}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
                  transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{ paddingLeft: 28, paddingRight: 10, height: 32,
                    border: `0.5px solid ${BORDER}`, borderRadius: 8, fontSize: 12,
                    outline: "none", color: DARK, width: 180, fontFamily: FONT }} />
              </div>
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>
              Chargement…
            </div>
          ) : (
            <Table columns={cols} rows={baseFiltered} />
          )}
          {!loading && baseFiltered.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>
              Aucune réservation pour la période sélectionnée
            </div>
          )}
        </Card>
      </motion.div>

      {/* Modal édition complète */}
      {editModal && (
        <Modal open title="Modifier la réservation" onClose={() => setEditModal(null)}>
          <div style={{ marginBottom: 12, padding: "8px 12px", background: BG,
            borderRadius: 8, fontSize: 12, color: MUTED }}>
            <strong style={{ color: DARK }}>{editModal.client_name}</strong>
            {" "} · {editModal.resto_name} · <span style={{ fontFamily: "monospace" }}>{editModal.ref}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Date & Heure">
              <Input value={editForm.reserved_at} type="datetime-local"
                onChange={e => setEditForm(p => ({ ...p, reserved_at: e.target.value }))} />
            </FormField>
            <FormField label="Nombre de personnes">
              <Input value={editForm.party_size} type="number"
                onChange={e => setEditForm(p => ({ ...p, party_size: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Statut">
            <Select value={editForm.status} onChange={v => setEditForm(p => ({ ...p, status: v }))}
              options={[
                { value: "en_attente", label: "En attente" },
                { value: "confirme",   label: "Confirmé" },
                { value: "annule",     label: "Annulé" },
              ]} />
          </FormField>
          <FormField label="Notes internes">
            <textarea value={editForm.notes}
              onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              placeholder="Notes visibles uniquement par l'équipe"
              style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
                padding: "9px 12px", fontSize: 13, color: DARK, background: BG,
                outline: "none", fontFamily: FONT, resize: "vertical", boxSizing: "border-box" }} />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => setEditModal(null)}>Annuler</Btn>
            <Btn variant="primary" onClick={saveEdit}>Enregistrer</Btn>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}
