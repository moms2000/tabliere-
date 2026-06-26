import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, CheckCircle, XCircle } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { reservationsService } from "../../services/reservations.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE = {
  confirme: "green", en_attente: "amber", annule: "red",
  confirmé: "green", "en attente": "amber", annulé: "red",
};

const fmt = (n) => n ? n.toLocaleString("fr-FR") + " F" : "—";

const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
  : "—";

export default function RestReservations() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("tous");

  useEffect(() => {
    reservationsService.list({ limit: 50 })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const confirm = async (id) => {
    try {
      await reservationsService.confirm(id);
      setData(prev => prev.map(r => r.id === id ? { ...r, status: "confirme" } : r));
    } catch (e) { console.error(e); }
  };

  const cancel = async (id) => {
    try {
      await reservationsService.cancel(id, "Annulé par le restaurateur");
      setData(prev => prev.map(r => r.id === id ? { ...r, status: "annule" } : r));
    } catch (e) { console.error(e); }
  };

  const filtered = filter === "tous" ? data : data.filter(r => r.status === filter || r.status === filter.replace("é","e").replace("è","e"));

  const cols = [
    { key: "ref",    label: "Réf",    render: r => <span style={{ fontFamily: "monospace", fontSize: 11, color: "#aaa" }}>{r.ref}</span> },
    { key: "client", label: "Client", render: r => <span style={{ fontWeight: 500 }}>{r.client_name || "—"}</span> },
    { key: "date",   label: "Date",   render: r => <span style={{ fontSize: 12 }}>{fmtDate(r.reserved_at)}</span> },
    { key: "pers",   label: "Pers.",  align: "center", render: r => r.party_size },
    { key: "table",  label: "Table",  align: "center", render: r => <span style={{ fontWeight: 500 }}>{r.table_label || "—"}</span> },
    { key: "montant",label: "Arrhes", align: "right",  render: r => <span style={{ fontWeight: 500 }}>{fmt(r.arrhes_amount)}</span> },
    { key: "status", label: "Statut", render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /> },
    { key: "actions",label: "",       align: "right",  render: r => {
      const pending = r.status === "en_attente" || r.status === "en attente";
      return pending ? (
        <div style={{ display: "flex", gap: 6 }}>
          <Btn onClick={() => confirm(r.id)} variant="primary" icon={CheckCircle}
            style={{ fontSize: 11, padding: "3px 9px" }}>Confirmer</Btn>
          <Btn onClick={() => cancel(r.id)} variant="danger" icon={XCircle}
            style={{ fontSize: 11, padding: "3px 9px" }}>Annuler</Btn>
        </div>
      ) : null;
    }},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Réservations" subtitle="Gestion des réservations" />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total",      val: data.length,                                                          color: "#1a1a1a" },
          { label: "Confirmées", val: data.filter(r => ["confirme","confirmé"].includes(r.status)).length,   color: "#1D9E75" },
          { label: "En attente", val: data.filter(r => ["en_attente","en attente"].includes(r.status)).length, color: "#854F0B" },
          { label: "Annulées",   val: data.filter(r => ["annule","annulé"].includes(r.status)).length,       color: "#993C1D" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <SectionHeader title="Liste des réservations" icon={CalendarCheck} />
            <div style={{ display: "flex", gap: 6 }}>
              {["tous","confirme","en_attente","annule"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize: 11, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
                    border: "0.5px solid", borderColor: filter === f ? "#1D9E75" : "#eee",
                    background: filter === f ? "#E1F5EE" : "white",
                    color: filter === f ? "#1D9E75" : "#666", textTransform: "capitalize" }}>
                  {f.replace("_"," ")}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>Chargement…</div>
          ) : (
            <Table columns={cols} rows={filtered} />
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
              Aucune réservation trouvée
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
