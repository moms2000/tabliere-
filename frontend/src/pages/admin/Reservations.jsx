import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Search, Users } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Table } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE = {
  confirme: "green", en_attente: "amber", annule: "red",
  confirmé: "green", "en attente": "amber", annulé: "red",
};

const fmt     = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "—";
const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
  : "—";

export default function Reservations() {
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("tous");

  useEffect(() => {
    const params = { limit: 50 };
    if (filter !== "tous") params.status = filter;
    adminService.listReservations(params)
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const filtered = search
    ? data.filter(r =>
        (r.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.resto_name  || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.ref         || "").toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const cols = [
    { key: "ref",    label: "Réf",           render: r => <span style={{ fontFamily: "monospace", fontSize: 11, color: "#999" }}>{r.ref}</span> },
    { key: "client", label: "Client",          render: r => <span style={{ fontWeight: 500 }}>{r.client_name || "—"}</span> },
    { key: "resto",  label: "Restaurant",      render: r => <span style={{ fontSize: 12, color: "#666" }}>{r.resto_name || "—"}</span> },
    { key: "date",   label: "Date & Heure",    render: r => <span style={{ fontSize: 12 }}>{fmtDate(r.reserved_at)}</span> },
    { key: "pers",   label: "Pers.",           align: "center", render: r => (
      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
        <Users size={12} color="#999" /><span style={{ fontSize: 12 }}>{r.party_size}</span>
      </div>
    )},
    { key: "montant",label: "Arrhes",          align: "right", render: r => (
      <span style={{ fontWeight: 500 }}>{fmt(r.arrhes_amount)}</span>
    )},
    { key: "status", label: "Statut",          render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /> },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Réservations" subtitle="Toutes les réservations de la plateforme" />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total",       val: total,                                                              color: "#1a1a1a" },
          { label: "Confirmées",  val: data.filter(r => ["confirme","confirmé"].includes(r.status)).length, color: "#1D9E75" },
          { label: "En attente",  val: data.filter(r => ["en_attente","en attente"].includes(r.status)).length, color: "#854F0B" },
          { label: "Annulées",    val: data.filter(r => ["annule","annulé"].includes(r.status)).length,    color: "#993C1D" },
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
            <SectionHeader title="Historique" icon={CalendarCheck} />
            <div style={{ display: "flex", gap: 8 }}>
              {["tous","confirme","en_attente","annule"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize: 11, padding: "4px 12px", borderRadius: 8, cursor: "pointer",
                    border: "0.5px solid", borderColor: filter === f ? "#1D9E75" : "#eee",
                    background: filter === f ? "#E1F5EE" : "white",
                    color: filter === f ? "#1D9E75" : "#666", textTransform: "capitalize" }}>
                  {f.replace("_"," ")}
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
