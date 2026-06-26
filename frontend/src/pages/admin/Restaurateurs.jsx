import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils, Plus, Search, QrCode, CheckCircle, XCircle } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Toggle, Table } from "../../components/ui";
import { RESTAURATEURS, fmt } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const PLAN_BADGE = { Premium: "green", Standard: "blue", Gratuit: "gray" };
const STATUS_BADGE = { actif: "green", suspendu: "red", "en attente": "amber" };

export default function Restaurateurs() {
  const [search, setSearch] = useState("");
  const [data, setData]     = useState(RESTAURATEURS);

  const toggleQr = (id) =>
    setData(prev => prev.map(r => r.id === id ? { ...r, qrActive: !r.qrActive } : r));

  const filtered = data.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.owner.toLowerCase().includes(search.toLowerCase()) ||
    r.ville.toLowerCase().includes(search.toLowerCase())
  );

  const cols = [
    { key: "name",    label: "Restaurant",  render: r => (
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div>
        <div style={{ fontSize: 11, color: "#aaa" }}>{r.ville}</div>
      </div>
    )},
    { key: "owner",   label: "Gérant",      render: r => <span style={{ fontSize: 13 }}>{r.owner}</span> },
    { key: "plan",    label: "Plan",         render: r => <Badge label={r.plan} variant={PLAN_BADGE[r.plan]} /> },
    { key: "status",  label: "Statut",       render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status]} /> },
    { key: "reserv",  label: "Réservations", align: "right", render: r => (
      <span style={{ fontWeight: 500 }}>{r.reserv}</span>
    )},
    { key: "rating",  label: "Note",         align: "center", render: r => (
      <span style={{ fontSize: 13 }}>{r.rating > 0 ? `${r.rating}/5` : "—"}</span>
    )},
    { key: "qrActive",label: "Menu QR",      align: "center", render: r => {
      const locked = r.plan === "Gratuit";
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {locked
            ? <span style={{ fontSize: 11, color: "#bbb" }}>Verrouillé</span>
            : <Toggle value={r.qrActive} onChange={() => toggleQr(r.id)} />
          }
        </div>
      );
    }},
    { key: "joined",  label: "Depuis",       render: r => <span style={{ fontSize: 11, color: "#999" }}>{r.joined}</span> },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Restaurateurs" subtitle={`${data.length} restaurants inscrits`} />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Actifs",      val: data.filter(r => r.status === "actif").length,      color: "#1D9E75" },
          { label: "Suspendus",   val: data.filter(r => r.status === "suspendu").length,   color: "#993C1D" },
          { label: "En attente",  val: data.filter(r => r.status === "en attente").length, color: "#854F0B" },
          { label: "QR activé",   val: data.filter(r => r.qrActive).length,               color: "#185FA5" },
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
            <SectionHeader title="Liste des restaurants" icon={Utensils} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
                  transform: "translateY(-50%)", color: "#bbb" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{ paddingLeft: 28, paddingRight: 10, height: 32, border: "0.5px solid #eee",
                    borderRadius: 8, fontSize: 12, outline: "none", color: "#333", width: 200 }} />
              </div>
              <Btn variant="primary" icon={Plus}>Ajouter</Btn>
            </div>
          </div>
          <Table columns={cols} rows={filtered} />
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
              Aucun restaurant trouvé
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
