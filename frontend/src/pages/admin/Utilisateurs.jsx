import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Search, ShieldOff, ShieldCheck } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { UTILISATEURS } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE = { actif: "green", bloqué: "red" };

export default function Utilisateurs() {
  const [search, setSearch] = useState("");
  const [data, setData]     = useState(UTILISATEURS);

  const toggleBlock = (id) =>
    setData(prev => prev.map(u =>
      u.id === id ? { ...u, status: u.status === "actif" ? "bloqué" : "actif" } : u
    ));

  const filtered = data.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.ville.toLowerCase().includes(search.toLowerCase())
  );

  const cols = [
    { key: "name",    label: "Utilisateur",  render: u => (
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{u.name}</div>
        <div style={{ fontSize: 11, color: "#aaa" }}>{u.email}</div>
      </div>
    )},
    { key: "ville",   label: "Ville",        render: u => <span style={{ fontSize: 13 }}>{u.ville}</span> },
    { key: "reserv",  label: "Réservations", align: "center", render: u => (
      <span style={{ fontWeight: 500 }}>{u.reserv}</span>
    )},
    { key: "lastRes", label: "Dernière résa",render: u => <span style={{ fontSize: 12, color: "#999" }}>{u.lastRes}</span> },
    { key: "status",  label: "Statut",       render: u => <Badge label={u.status} variant={STATUS_BADGE[u.status]} /> },
    { key: "joined",  label: "Inscrit",      render: u => <span style={{ fontSize: 11, color: "#bbb" }}>{u.joined}</span> },
    { key: "actions", label: "",             align: "right", render: u => (
      <Btn onClick={() => toggleBlock(u.id)}
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
        <PageTitle title="Utilisateurs" subtitle={`${data.length} comptes enregistrés`} />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total",    val: data.length,                                    color: "#1a1a1a" },
          { label: "Actifs",   val: data.filter(u => u.status === "actif").length,  color: "#1D9E75" },
          { label: "Bloqués",  val: data.filter(u => u.status === "bloqué").length, color: "#993C1D" },
          { label: "Ce mois",  val: 214,                                            color: "#185FA5" },
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
          <Table columns={cols} rows={filtered} />
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
              Aucun utilisateur trouvé
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
