import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutTemplate, Users, X, Plus } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn } from "../../components/ui";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const COLOR = { libre: "#1D9E75", occupé: "#993C1D", réservé: "#854F0B", free: "#1D9E75", occupied: "#993C1D", reserved: "#854F0B" };
const BG    = { libre: "#E1F5EE", occupé: "#FAECE7", réservé: "#FAEEDA", free: "#E1F5EE", occupied: "#FAECE7", reserved: "#FAEEDA" };
const BADGE = { libre: "green",   occupé: "red",     réservé: "amber",   free: "green",   occupied: "red",     reserved: "amber" };
const LABEL = { libre: "Libre",   occupé: "Occupé",  réservé: "Réservé", free: "Libre",   occupied: "Occupé",  reserved: "Réservé" };

function TableCard({ table, onClick }) {
  const color = COLOR[table.status] || "#aaa";
  const bg    = BG[table.status]    || "#f5f5f5";
  const badge = BADGE[table.status] || "gray";
  const label = LABEL[table.status] || table.status;

  return (
    <motion.div whileHover={{ y: -2, boxShadow: "0 4px 14px rgba(0,0,0,.07)" }}
      whileTap={{ scale: 0.97 }} onClick={() => onClick(table)}
      style={{ borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        background: bg, border: `1px solid ${color}44`, textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color }}>{table.label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
        marginTop: 3, fontSize: 11, color: "#888" }}>
        <Users size={11} />{table.capacity}p
      </div>
      <div style={{ marginTop: 6 }}>
        <Badge label={label} variant={badge} />
      </div>
    </motion.div>
  );
}

export default function RestPlanSalle() {
  const { user } = useAuth();
  const [tables,   setTables]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [resto,    setResto]    = useState(null);

  useEffect(() => {
    if (!user) return;
    if (!user.resto_id) {
      setLoading(false);
      return;
    }
    restaurantsService.getManage(user.resto_id)
      .then(d => {
        setResto(d.restaurant);
        setTables(d.restaurant?.tables || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.resto_id, user]);

  const updateTableStatus = async (tableId, newStatus) => {
    try {
      await restaurantsService.updateTable(user.resto_id, tableId, { status: newStatus });
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
      setSelected(prev => prev?.id === tableId ? { ...prev, status: newStatus } : prev);
    } catch (e) { console.error(e); }
  };

  const interior = tables.filter(t => t.zone === "interieur" || t.zone === "interior" || !t.zone);
  const terrace  = tables.filter(t => t.zone === "terrasse"  || t.zone === "terrace");

  const libres   = tables.filter(t => ["libre","free"].includes(t.status)).length;
  const occupees = tables.filter(t => ["occupé","occupied"].includes(t.status)).length;
  const reservees = tables.filter(t => ["réservé","reserved"].includes(t.status)).length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Plan de salle" subtitle="Gestion des tables en temps réel" />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Libres",    val: libres,         color: "#1D9E75" },
          { label: "Occupées",  val: occupees,       color: "#993C1D" },
          { label: "Réservées", val: reservees,      color: "#854F0B" },
          { label: "Total",     val: tables.length,  color: "#1a1a1a" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb", fontSize: 13 }}>Chargement…</div>
      ) : tables.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Aucune table configurée</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Ajoutez des tables pour gérer votre plan de salle</div>
        </div>
      ) : (
        <>
          {interior.length > 0 && (
            <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
              <Card>
                <SectionHeader title="Salle intérieure" icon={LayoutTemplate} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {interior.map(t => <TableCard key={t.id} table={t} onClick={setSelected} />)}
                </div>
              </Card>
            </motion.div>
          )}

          {terrace.length > 0 && (
            <motion.div variants={fadeUp}>
              <Card>
                <SectionHeader title="Terrasse" icon={LayoutTemplate} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {terrace.map(t => <TableCard key={t.id} table={t} onClick={setSelected} />)}
                </div>
              </Card>
            </motion.div>
          )}

          {interior.length === 0 && terrace.length === 0 && tables.length > 0 && (
            <motion.div variants={fadeUp}>
              <Card>
                <SectionHeader title="Tables" icon={LayoutTemplate} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {tables.map(t => <TableCard key={t.id} table={t} onClick={setSelected} />)}
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {/* Drawer détail */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.18)", zIndex: 40 }} />
            <motion.div initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 300,
                background: "white", zIndex: 50, padding: 20,
                boxShadow: "-4px 0 20px rgba(0,0,0,.1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>Table {selected.label}</span>
                <button onClick={() => setSelected(null)}
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <X size={18} color="#888" />
                </button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <Badge label={LABEL[selected.status] || selected.status} variant={BADGE[selected.status] || "gray"} />
              </div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
                Capacité : <strong>{selected.capacity} personnes</strong>
              </div>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {["libre","réservé","occupé"].filter(s => s !== selected.status).map(s => (
                  <Btn key={s} onClick={() => updateTableStatus(selected.id, s)}
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
