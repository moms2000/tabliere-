import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutTemplate, Users, X } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn } from "../../components/ui";
import { TABLES } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const COLOR   = { libre: "#1D9E75", occupé: "#993C1D", réservé: "#854F0B" };
const BG      = { libre: "#E1F5EE", occupé: "#FAECE7", réservé: "#FAEEDA" };
const BADGE   = { libre: "green",   occupé: "red",     réservé: "amber" };
const LABEL   = { libre: "Libre",   occupé: "Occupé",  réservé: "Réservé" };

const interior = ["T1","T2","T3","T4","T5","T6","T7","T8"];
const terrace  = ["TE1","TE2","TE3","TE4"];

function TableCard({ table, onClick }) {
  return (
    <motion.div whileHover={{ y: -2, boxShadow: "0 4px 14px rgba(0,0,0,.07)" }}
      whileTap={{ scale: 0.97 }} onClick={() => onClick(table)}
      style={{ borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        background: BG[table.status], border: `1px solid ${COLOR[table.status]}44`,
        textAlign: "center", position: "relative" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: COLOR[table.status] }}>{table.id}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
        marginTop: 3, fontSize: 11, color: "#888" }}>
        <Users size={11} />{table.cap}p
      </div>
      <div style={{ marginTop: 6 }}>
        <Badge label={LABEL[table.status]} variant={BADGE[table.status]} />
      </div>
      {table.client && (
        <div style={{ marginTop: 5, fontSize: 10, color: "#aaa" }}>{table.client} · {table.heure}</div>
      )}
    </motion.div>
  );
}

export default function RestPlanSalle() {
  const [tables, setTables] = useState(TABLES);
  const [selected, setSelected] = useState(null);

  const cycle = (id) => {
    const order = ["libre","réservé","occupé"];
    setTables(prev => prev.map(t =>
      t.id === id ? { ...t, status: order[(order.indexOf(t.status) + 1) % order.length] } : t
    ));
  };

  const intTables = tables.filter(t => interior.includes(t.id));
  const terTables = tables.filter(t => terrace.includes(t.id));
  const libres    = tables.filter(t => t.status === "libre").length;
  const occupees  = tables.filter(t => t.status === "occupé").length;
  const reservees = tables.filter(t => t.status === "réservé").length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Plan de salle" subtitle="Gestion des tables en temps réel" />
      </motion.div>

      {/* Légende stats */}
      <motion.div variants={fadeUp}
        style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Libres",    val: libres,    color: "#1D9E75" },
          { label: "Occupées",  val: occupees,  color: "#993C1D" },
          { label: "Réservées", val: reservees, color: "#854F0B" },
          { label: "Total",     val: tables.length, color: "#1a1a1a" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center",
            justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      {/* Salle intérieure */}
      <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
        <Card>
          <SectionHeader title="Salle intérieure" icon={LayoutTemplate} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {intTables.map(t => (
              <TableCard key={t.id} table={t} onClick={t => setSelected(t)} />
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Terrasse */}
      <motion.div variants={fadeUp}>
        <Card>
          <SectionHeader title="Terrasse" icon={LayoutTemplate} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {terTables.map(t => (
              <TableCard key={t.id} table={t} onClick={t => setSelected(t)} />
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Drawer détail table */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.18)", zIndex: 40 }} />
            <motion.div initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 300,
                background: "white", zIndex: 50, padding: 20, boxShadow: "-4px 0 20px rgba(0,0,0,.1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>Table {selected.id}</span>
                <button onClick={() => setSelected(null)}
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <X size={18} color="#888" />
                </button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <Badge label={LABEL[selected.status]} variant={BADGE[selected.status]} />
              </div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                Capacité : <strong>{selected.cap} personnes</strong>
              </div>
              {selected.client && (
                <>
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                    Client : <strong>{selected.client}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
                    Heure : <strong>{selected.heure}</strong>
                  </div>
                </>
              )}
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {["libre","réservé","occupé"].filter(s => s !== selected.status).map(s => (
                  <Btn key={s} onClick={() => {
                    setTables(prev => prev.map(t => t.id === selected.id ? { ...t, status: s } : t));
                    setSelected(prev => ({ ...prev, status: s }));
                  }}
                  variant={s === "libre" ? "primary" : s === "occupé" ? "danger" : "default"}>
                    Marquer comme {s}
                  </Btn>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
