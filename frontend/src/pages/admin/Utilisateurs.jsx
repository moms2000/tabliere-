import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Search, ShieldOff, ShieldCheck } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE = { actif: "green", bloque: "red", bloqué: "red", suspendu: "red" };

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("fr-FR") : "—";

export default function Utilisateurs() {
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  const load = () => {
    adminService.listUsers({ search: search || undefined, role: "client", limit: 50 })
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const toggleBlock = async (user) => {
    const newStatus = user.status === "actif" ? "bloque" : "actif";
    try {
      await adminService.setUserStatus(user.id, newStatus);
      setData(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (e) { console.error(e); }
  };

  const cols = [
    { key: "name",    label: "Utilisateur", render: u => (
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{u.full_name}</div>
        <div style={{ fontSize: 11, color: "#aaa" }}>{u.email}</div>
      </div>
    )},
    { key: "phone",  label: "Téléphone", render: u => <span style={{ fontSize: 12, color: "#888" }}>{u.phone || "—"}</span> },
    { key: "reserv", label: "Réservations", align: "center", render: u => (
      <span style={{ fontWeight: 500 }}>{u.resa_count || 0}</span>
    )},
    { key: "status", label: "Statut",   render: u => <Badge label={u.status} variant={STATUS_BADGE[u.status] || "gray"} /> },
    { key: "joined", label: "Inscrit",  render: u => <span style={{ fontSize: 11, color: "#bbb" }}>{fmtDate(u.created_at)}</span> },
    { key: "actions",label: "",         align: "right", render: u => (
      <Btn onClick={() => toggleBlock(u)}
        variant={u.status === "actif" ? "danger" : "default"}
        icon={u.status === "actif" ? ShieldOff : ShieldCheck}
        style={{ fontSize: 11, padding: "4px 10px" }}>
        {u.status === "actif" ? "Bloquer" : "Débloquer"}
      </Btn>
    )},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Utilisateurs" subtitle={`${total} comptes enregistrés`} />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total",   val: total,                                                           color: "#1a1a1a" },
          { label: "Actifs",  val: data.filter(u => u.status === "actif").length,                  color: "#1D9E75" },
          { label: "Bloqués", val: data.filter(u => ["bloque","bloqué"].includes(u.status)).length, color: "#993C1D" },
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
            <SectionHeader title="Liste des utilisateurs" icon={Users} />
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
              Aucun utilisateur trouvé
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
