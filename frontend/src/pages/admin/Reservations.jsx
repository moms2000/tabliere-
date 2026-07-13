import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Search, Users, Pencil, Check, X, FileText, Sheet } from "lucide-react";
import { runAdminExport } from "../../services/adminExport.js";
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
  const [counts,   setCounts]   = useState({ total: 0, confirme: 0, en_attente: 0, annule: 0 });
  const [loading,  setLoading]  = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search,   setSearch]   = useState("");   // valeur débattue envoyée au serveur
  const [filter,   setFilter]   = useState("tous");
  const [dateMode, setDateMode] = useState("Mois");
  const [page,     setPage]     = useState(1);
  const [editModal, setEditModal] = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [exporting, setExporting] = useState(null); // "pdf" | "xls" | null
  const LIMIT = 30;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Bornes de dates calculées côté client, filtrage effectué côté serveur
  // (indispensable avec la pagination : sinon on ne filtrerait que la page chargée).
  const dateRange = (mode) => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    if (mode === "Jour")  return { from: new Date(y, m, d, 0, 0, 0).toISOString(),   to: new Date(y, m, d, 23, 59, 59).toISOString() };
    if (mode === "Mois")  return { from: new Date(y, m, 1, 0, 0, 0).toISOString(),   to: new Date(y, m + 1, 0, 23, 59, 59).toISOString() };
    if (mode === "Année") return { from: new Date(y, 0, 1, 0, 0, 0).toISOString(),   to: new Date(y, 11, 31, 23, 59, 59).toISOString() };
    return {};
  };

  const buildParams = (pageArg) => {
    const { from, to } = dateRange(dateMode);
    const params = { limit: LIMIT, page: pageArg };
    if (filter !== "tous") params.status = filter;
    if (search) params.search = search;
    if (from)   params.from = from;
    if (to)     params.to = to;
    return params;
  };

  // Débounce de la recherche (350ms) → on ne requête pas à chaque frappe
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Tout changement de filtre/période/recherche ramène à la page 1
  useEffect(() => { setPage(1); }, [filter, dateMode, search]);

  useEffect(() => {
    setLoading(true);
    adminService.listReservations(buildParams(page))
      .then(res => {
        setData(res.data || []);
        setTotal(res.pagination?.total || 0);
        if (res.counts) setCounts(res.counts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter, dateMode, search, page]);

  const updateInline = async (id, fields) => {
    // Ne plus masquer les erreurs : on n'applique le changement local qu'après
    // succès serveur, sinon on prévient l'admin et on resynchronise depuis l'API.
    try {
      if (!adminService.updateReservation) throw new Error("Action indisponible");
      await adminService.updateReservation(id, fields);
      setData(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error?.message || e?.message || "Échec de la mise à jour";
      alert(`Mise à jour impossible : ${msg}`);
      // Resynchroniser la liste avec l'état réel en base (même page/filtres)
      adminService.listReservations(buildParams(page))
        .then(res => { setData(res.data || []); if (res.counts) setCounts(res.counts); })
        .catch(() => {});
    }
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

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <PageTitle title="Réservations" subtitle="Toutes les réservations de la plateforme" />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <DateFilter value={dateMode} onChange={setDateMode} />
            {[["pdf", FileText, "PDF"], ["xls", Sheet, "Excel"]].map(([kind, Icon, label]) => (
              <button key={kind} onClick={async () => {
                  setExporting(kind);
                  try {
                    const { total, exported } = await runAdminExport("reservations", kind, { title: "Réservations", filename: "reservations" });
                    if (kind === "pdf" && exported < total) alert(`PDF limité aux ${exported} premières lignes. Utilisez Excel pour les ${total} réservations.`);
                  } catch (e) { alert("Export impossible : " + (e?.response?.data?.message || e.message)); }
                  finally { setExporting(null); }
                }}
                disabled={!!exporting}
                style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px",
                  border: "0.5px solid #E4DFD8", borderRadius: 8, background: "white",
                  cursor: exporting ? "default" : "pointer", fontSize: 12, color: "#555", fontFamily: FONT }}>
                <Icon size={13} /> {exporting === kind ? "…" : label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Compteurs */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Total",       val: counts.total,      color: DARK },
          { label: "Confirmées",  val: counts.confirme,   color: S },
          { label: "En attente",  val: counts.en_attente, color: "#C47D1A" },
          { label: "Annulées",    val: counts.annule,     color: "#DC2626" },
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
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
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
            <Table columns={cols} rows={data} />
          )}
          {!loading && data.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>
              Aucune réservation pour la période sélectionnée
            </div>
          )}
          {/* Pagination */}
          {total > LIMIT && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 14px", background: "white",
                  cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: 13, fontFamily: FONT }}>← Préc.</button>
              <span style={{ fontSize: 13, color: MUTED }}>Page {page} / {totalPages} · {total} réservations</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 14px", background: "white",
                  cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: 13, fontFamily: FONT }}>Suiv. →</button>
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
