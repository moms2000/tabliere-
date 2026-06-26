import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Search, Users, Banknote } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Table } from "../../components/ui";
import { RESERVATIONS, fmt } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE   = { confirmé: "green", "en attente": "amber", annulé: "red" };
const PAYMENT_BADGE  = { "MTN MoMo": "amber", "Wave": "blue", "Orange Money": "amber", "Carte bancaire": "gray", "—": "gray" };

export default function Reservations() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("tous");

  const filtered = RESERVATIONS.filter(r => {
    const matchSearch = r.client.toLowerCase().includes(search.toLowerCase()) ||
      r.resto.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "tous" || r.status === filter;
    return matchSearch && matchFilter;
  });

  const total = RESERVATIONS.reduce((a, r) => a + r.montant, 0);

  const cols = [
    { key: "id",      label: "ID",            render: r => (
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#999" }}>{r.id}</span>
    )},
    { key: "client",  label: "Client",         render: r => <span style={{ fontWeight: 500 }}>{r.client}</span> },
    { key: "resto",   label: "Restaurant",      render: r => <span style={{ fontSize: 12, color: "#666" }}>{r.resto}</span> },
    { key: "date",    label: "Date & Heure",    render: r => <span style={{ fontSize: 12 }}>{r.date}</span> },
    { key: "pers",    label: "Pers.",           align: "center", render: r => (
      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
        <Users size={12} color="#999" /><span style={{ fontSize: 12 }}>{r.pers}</span>
      </div>
    )},
    { key: "table",   label: "Table",          align: "center", render: r => (
      <span style={{ fontWeight: 500, fontSize: 12 }}>{r.table}</span>
    )},
    { key: "payment", label: "Paiement",        render: r => <Badge label={r.payment} variant={PAYMENT_BADGE[r.payment] || "gray"} /> },
    { key: "montant", label: "Montant",         align: "right", render: r => (
      <span style={{ fontWeight: 500 }}>{r.montant ? fmt(r.montant) : "—"}</span>
    )},
    { key: "status",  label: "Statut",          render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status]} /> },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Réservations" subtitle="Toutes les réservations de la plateforme" />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total",       val: RESERVATIONS.length,                                        color: "#1a1a1a" },
          { label: "Confirmées",  val: RESERVATIONS.filter(r => r.status === "confirmé").length,   color: "#1D9E75" },
          { label: "En attente",  val: RESERVATIONS.filter(r => r.status === "en attente").length, color: "#854F0B" },
          { label: "Chiffre d'affaires", val: fmt(total),                                          color: "#185FA5" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center",
            justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: i === 3 ? 14 : 20, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <SectionHeader title="Historique des réservations" icon={CalendarCheck} />
            <div style={{ display: "flex", gap: 8 }}>
              {["tous", "confirmé", "en attente", "annulé"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, cursor: "pointer",
                    border: "0.5px solid",
                    borderColor: filter === f ? "#1D9E75" : "#eee",
                    background: filter === f ? "#E1F5EE" : "white",
                    color: filter === f ? "#1D9E75" : "#666",
                    textTransform: "capitalize" }}>
                  {f}
                </button>
              ))}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
                  transform: "translateY(-50%)", color: "#bbb" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{ paddingLeft: 28, paddingRight: 10, height: 32, border: "0.5px solid #eee",
                    borderRadius: 8, fontSize: 12, outline: "none", color: "#333", width: 180 }} />
              </div>
            </div>
          </div>
          <Table columns={cols} rows={filtered} />
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
              Aucune réservation trouvée
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
