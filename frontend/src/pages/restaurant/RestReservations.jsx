import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { RESERVATIONS, fmt } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE = { confirmé: "green", "en attente": "amber", annulé: "red" };

export default function RestReservations() {
  const [data, setData] = useState(RESERVATIONS);
  const [filter, setFilter] = useState("tous");

  const confirm = (id) => setData(prev =>
    prev.map(r => r.id === id ? { ...r, status: "confirmé" } : r));
  const cancel = (id) => setData(prev =>
    prev.map(r => r.id === id ? { ...r, status: "annulé" } : r));

  const filtered = filter === "tous" ? data : data.filter(r => r.status === filter);

  const cols = [
    { key: "id",     label: "ID",       render: r => (
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#aaa" }}>{r.id}</span>
    )},
    { key: "client", label: "Client",   render: r => <span style={{ fontWeight: 500 }}>{r.client}</span> },
    { key: "date",   label: "Heure",    render: r => <span style={{ fontSize: 12 }}>{r.date.split("·")[1]}</span> },
    { key: "pers",   label: "Pers.",    align: "center" },
    { key: "table",  label: "Table",    align: "center", render: r => <span style={{ fontWeight: 500 }}>{r.table}</span> },
    { key: "payment",label: "Paiement", render: r => <span style={{ fontSize: 12, color: "#777" }}>{r.payment}</span> },
    { key: "montant",label: "Montant",  align: "right", render: r => <span style={{ fontWeight: 500 }}>{r.montant ? fmt(r.montant) : "—"}</span> },
    { key: "status", label: "Statut",   render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status]} /> },
    { key: "actions",label: "",         align: "right", render: r => (
      r.status === "en attente" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <Btn onClick={() => confirm(r.id)} variant="primary" icon={CheckCircle}
            style={{ fontSize: 11, padding: "3px 9px" }}>Confirmer</Btn>
          <Btn onClick={() => cancel(r.id)} variant="danger" icon={XCircle}
            style={{ fontSize: 11, padding: "3px 9px" }}>Annuler</Btn>
        </div>
      ) : null
    )},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Réservations" subtitle="Gestion des réservations — Le Maquis du Plateau" />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Ce soir",      val: data.length,                                        color: "#1a1a1a" },
          { label: "Confirmées",   val: data.filter(r => r.status === "confirmé").length,   color: "#1D9E75" },
          { label: "En attente",   val: data.filter(r => r.status === "en attente").length, color: "#854F0B" },
          { label: "Annulées",     val: data.filter(r => r.status === "annulé").length,     color: "#993C1D" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center",
            justifyContent: "space-between" }}>
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
              {["tous","confirmé","en attente","annulé"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize: 11, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
                    border: "0.5px solid",
                    borderColor: filter === f ? "#1D9E75" : "#eee",
                    background: filter === f ? "#E1F5EE" : "white",
                    color: filter === f ? "#1D9E75" : "#666",
                    textTransform: "capitalize" }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <Table columns={cols} rows={filtered} />
        </Card>
      </motion.div>
    </motion.div>
  );
}
