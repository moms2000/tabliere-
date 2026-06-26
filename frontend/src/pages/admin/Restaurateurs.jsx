import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Utensils, Search } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const PLAN_BADGE   = { premium: "green", standard: "blue", gratuit: "gray" };
const STATUS_BADGE = { actif: "green", suspendu: "red", en_attente: "amber", "en attente": "amber" };

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("fr-FR") : "—";

export default function Restaurateurs() {
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    adminService.listRestaurants({ search: search || undefined, limit: 50 })
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  const setStatus = async (id, status) => {
    try {
      await adminService.setRestaurantStatus(id, status);
      setData(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) { console.error(e); }
  };

  const cols = [
    { key: "name",   label: "Restaurant", render: r => (
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div>
        <div style={{ fontSize: 11, color: "#aaa" }}>{r.quartier ? `${r.quartier}, ` : ""}{r.ville}</div>
      </div>
    )},
    { key: "owner",  label: "Gérant",      render: r => <span style={{ fontSize: 13 }}>{r.owner_name || "—"}</span> },
    { key: "plan",   label: "Plan",         render: r => <Badge label={r.plan || "gratuit"} variant={PLAN_BADGE[r.plan] || "gray"} /> },
    { key: "status", label: "Statut",       render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /> },
    { key: "reserv", label: "Réservations", align: "right", render: r => <span style={{ fontWeight: 500 }}>{r.resa_count || 0}</span> },
    { key: "rating", label: "Note",         align: "center", render: r => (
      <span style={{ fontSize: 13 }}>{r.rating > 0 ? `${r.rating}/5` : "—"}</span>
    )},
    { key: "joined", label: "Depuis",       render: r => <span style={{ fontSize: 11, color: "#999" }}>{fmtDate(r.created_at)}</span> },
    { key: "actions",label: "",             align: "right", render: r => (
      <div style={{ display: "flex", gap: 4 }}>
        {r.status !== "actif" && (
          <Btn onClick={() => setStatus(r.id, "actif")} variant="primary"
            style={{ fontSize: 11, padding: "3px 8px" }}>Activer</Btn>
        )}
        {r.status !== "suspendu" && (
          <Btn onClick={() => setStatus(r.id, "suspendu")} variant="danger"
            style={{ fontSize: 11, padding: "3px 8px" }}>Suspendre</Btn>
        )}
      </div>
    )},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Restaurateurs" subtitle={`${total} restaurants inscrits`} />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Actifs",     val: data.filter(r => r.status === "actif").length,                  color: "#1D9E75" },
          { label: "Suspendus",  val: data.filter(r => r.status === "suspendu").length,               color: "#993C1D" },
          { label: "En attente", val: data.filter(r => ["en_attente","en attente"].includes(r.status)).length, color: "#854F0B" },
          { label: "Total",      val: total,                                                           color: "#1a1a1a" },
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
            <SectionHeader title="Liste des restaurants" icon={Utensils} />
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
                transform: "translateY(-50%)", color: "#bbb" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                style={{ paddingLeft: 28, paddingRight: 10, height: 32, border: "0.5px solid #eee",
                  borderRadius: 8, fontSize: 12, outline: "none", color: "#333", width: 200 }} />
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>Chargement…</div>
          ) : (
            <Table columns={cols} rows={data} />
          )}
          {!loading && data.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
              Aucun restaurant trouvé
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
