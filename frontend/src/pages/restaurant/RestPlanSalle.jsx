import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutTemplate, Users, Plus, Pencil, Trash2, Settings } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Modal, FormField, Input, Select } from "../../components/ui";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const STC = { libre: S, occupé: "#DC2626", réservé: "#C47D1A", free: S, occupied: "#DC2626", reserved: "#C47D1A" };
const STB = { libre: "green", occupé: "red", réservé: "amber", free: "green", occupied: "red", reserved: "amber" };
const STL = { libre: "Libre", occupé: "Occupé", réservé: "Réservé", free: "Libre", occupied: "Occupé", reserved: "Réservé" };

export default function RestPlanSalle() {
  const { user } = useAuth();
  const [tables,     setTables]     = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [configMode, setConfigMode] = useState(false);
  const [modalTable, setModalTable] = useState(false);
  const [editTable,  setEditTable]  = useState(null);
  const [form, setForm] = useState({ label: "", capacity: 2, zone: "interieur", status: "libre" });

  useEffect(() => {
    if (!user?.resto_id) { setLoading(false); return; }
    restaurantsService.getManage(user.resto_id)
      .then(d => setTables(d.restaurant?.tables || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.resto_id]);

  const updateStatus = async (tableId, newStatus) => {
    try {
      await restaurantsService.updateTable(user.resto_id, tableId, { status: newStatus });
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
      setSelected(prev => prev?.id === tableId ? { ...prev, status: newStatus } : prev);
    } catch (e) { console.error(e); }
  };

  const saveTable = async () => {
    try {
      if (editTable) {
        await restaurantsService.updateTable(user.resto_id, editTable.id, form);
        setTables(prev => prev.map(t => t.id === editTable.id ? { ...t, ...form } : t));
      } else {
        const res = await restaurantsService.createTable(user.resto_id, form).catch(() => null);
        const n = res?.table || { id: Date.now(), ...form };
        setTables(prev => [...prev, n]);
      }
    } catch (e) { console.error(e); }
    setModalTable(false); setEditTable(null);
  };

  const deleteTable = async (id) => {
    if (!window.confirm("Supprimer cette table ?")) return;
    try {
      await restaurantsService.deleteTable(user.resto_id, id).catch(() => null);
      setTables(prev => prev.filter(t => t.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) { console.error(e); }
  };

  const openNew  = () => { setEditTable(null); setForm({ label: "", capacity: 2, zone: "interieur", status: "libre" }); setModalTable(true); };
  const openEdit = (t) => { setEditTable(t); setForm({ label: t.label, capacity: t.capacity, zone: t.zone || "interieur", status: t.status || "libre" }); setModalTable(true); };

  const zones    = [...new Set(tables.map(t => t.zone || "interieur"))];
  const libres   = tables.filter(t => ["libre","free"].includes(t.status)).length;
  const occupees = tables.filter(t => ["occupé","occupied"].includes(t.status)).length;
  const reservees = tables.filter(t => ["réservé","reserved"].includes(t.status)).length;

  const ZONE_LABELS = { interieur: "Salle intérieure", terrasse: "Terrasse", bar: "Bar / Comptoir", vip: "Espace VIP" };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <PageTitle title="Plan de salle" subtitle="Gestion des tables en temps réel" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn icon={Settings} variant={configMode ? "primary" : "default"}
              onClick={() => setConfigMode(p => !p)}>
              {configMode ? "Vue normale" : "Configurer"}
            </Btn>
            <Btn variant="primary" icon={Plus} onClick={openNew}>Nouvelle table</Btn>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Libres",    val: libres,         color: S },
          { label: "Occupées",  val: occupees,       color: "#DC2626" },
          { label: "Réservées", val: reservees,      color: "#C47D1A" },
          { label: "Total",     val: tables.length,  color: DARK },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "white", border: `0.5px solid ${BORDER}`,
            borderRadius: 12, padding: "10px 14px", display: "flex",
            alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: MUTED }}>{s.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontSize: 13 }}>Chargement…</div>
      ) : tables.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: PL,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <LayoutTemplate size={26} color={P} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: DARK, marginBottom: 6 }}>
              Aucune table configurée
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 18 }}>
              Créez vos tables pour gérer votre plan de salle
            </div>
            <Btn variant="primary" icon={Plus} onClick={openNew} style={{ margin: "0 auto" }}>
              Ajouter la première table
            </Btn>
          </div>
        </Card>
      ) : (
        <>
          {zones.map(zone => {
            const zt = tables.filter(t => (t.zone || "interieur") === zone);
            if (!zt.length) return null;
            return (
              <motion.div key={zone} variants={fadeUp} style={{ marginBottom: 14 }}>
                <Card>
                  <SectionHeader title={ZONE_LABELS[zone] || zone} icon={LayoutTemplate} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                    {zt.map(t => (
                      <motion.div key={t.id}
                        whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(30,46,40,.08)" }}
                        style={{ borderRadius: 12, background: "white",
                          border: `0.5px solid ${BORDER}`, overflow: "hidden",
                          cursor: configMode ? "default" : "pointer" }}
                        onClick={() => !configMode && setSelected(t)}>
                        <div style={{ height: 4, background: STC[t.status] || MUTED }} />
                        <div style={{ padding: "10px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 4 }}>{t.label}</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                            gap: 3, fontSize: 11, color: MUTED, marginBottom: 8 }}>
                            <Users size={11} />{t.capacity}p
                          </div>
                          <Badge label={STL[t.status] || t.status} variant={STB[t.status] || "gray"} />
                        </div>
                        {configMode && (
                          <div style={{ display: "flex", borderTop: `0.5px solid ${BG}` }}>
                            <button onClick={() => openEdit(t)}
                              style={{ flex: 1, border: "none", background: "transparent",
                                cursor: "pointer", padding: "6px 0", color: MUTED,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 3, fontSize: 11, fontFamily: FONT }}>
                              <Pencil size={10} />Modifier
                            </button>
                            <div style={{ width: "0.5px", background: BG }} />
                            <button onClick={() => deleteTable(t.id)}
                              style={{ flex: 1, border: "none", background: "transparent",
                                cursor: "pointer", padding: "6px 0", color: "#FECACA",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 3, fontSize: 11, fontFamily: FONT }}>
                              <Trash2 size={10} />Supprimer
                            </button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </>
      )}

      {/* Drawer statut */}
      <AnimatePresence>
        {selected && !configMode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.2)", zIndex: 40 }} />
            <motion.div initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 300,
                background: "white", zIndex: 50, padding: 22, fontFamily: FONT,
                boxShadow: "-4px 0 20px rgba(0,0,0,.1)" }}>
              <div style={{ display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 18 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: DARK }}>
                  Table {selected.label}
                </span>
                <button onClick={() => setSelected(null)}
                  style={{ border: "none", background: "transparent",
                    cursor: "pointer", color: MUTED, fontSize: 22 }}>×</button>
              </div>
              <Badge label={STL[selected.status] || selected.status}
                variant={STB[selected.status] || "gray"} />
              <div style={{ fontSize: 13, color: MUTED, margin: "12px 0 20px" }}>
                Capacité : <strong style={{ color: DARK }}>{selected.capacity} personnes</strong>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED,
                textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                Changer le statut
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["libre","réservé","occupé"].filter(s => s !== selected.status).map(s => (
                  <Btn key={s} onClick={() => updateStatus(selected.id, s)}
                    variant={s === "libre" ? "secondary" : s === "occupé" ? "danger" : "default"}
                    style={{ justifyContent: "center" }}>
                    Marquer comme {s}
                  </Btn>
                ))}
              </div>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `0.5px solid ${BORDER}` }}>
                <Btn icon={Pencil} onClick={() => { setSelected(null); openEdit(selected); }}
                  style={{ width: "100%", justifyContent: "center" }}>
                  Modifier la table
                </Btn>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal table */}
      {modalTable && (
        <Modal open title={editTable ? "Modifier la table" : "Nouvelle table"}
          onClose={() => { setModalTable(false); setEditTable(null); }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Numéro / Label">
              <Input value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder="Table 1, T-VIP…" />
            </FormField>
            <FormField label="Capacité (pers.)">
              <Input value={form.capacity} type="number"
                onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))} />
            </FormField>
          </div>
          <FormField label="Zone">
            <Select value={form.zone} onChange={v => setForm(p => ({ ...p, zone: v }))}
              options={[
                { value: "interieur", label: "Salle intérieure" },
                { value: "terrasse",  label: "Terrasse" },
                { value: "bar",       label: "Bar / Comptoir" },
                { value: "vip",       label: "Espace VIP" },
              ]} />
          </FormField>
          <FormField label="Statut initial">
            <Select value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))}
              options={[
                { value: "libre",   label: "Libre" },
                { value: "réservé", label: "Réservé" },
                { value: "occupé",  label: "Occupé" },
              ]} />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => { setModalTable(false); setEditTable(null); }}>Annuler</Btn>
            <Btn variant="primary" onClick={saveTable} disabled={!form.label || !form.capacity}>
              {editTable ? "Enregistrer" : "Créer"}
            </Btn>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}
