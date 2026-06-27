import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import {
  LayoutTemplate, Users, Plus, Pencil, Trash2,
  Settings, QrCode, Download, X,
} from "lucide-react";
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

const ZONE_LABELS = { interieur: "Salle intérieure", terrasse: "Terrasse", bar: "Bar / Comptoir", vip: "Espace VIP" };
const ZONE_ICONS  = { interieur: "🪑", terrasse: "🌿", bar: "🍸", vip: "⭐" };

/* ── Table shape : ronde pour bar, carrée sinon ── */
function TableShape({ table, onClick, selected }) {
  const color  = STC[table.status] || MUTED;
  const isBar  = (table.zone || "interieur") === "bar";
  const isSel  = selected?.id === table.id;

  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        width: isBar ? 64 : 84,
        height: isBar ? 64 : 72,
        borderRadius: isBar ? "50%" : 12,
        background: color + "18",
        border: `2px solid ${isSel ? DARK : color}`,
        outline: isSel ? `3px solid ${color}44` : "none",
        cursor: "pointer",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 2, position: "relative",
        boxShadow: isSel ? `0 4px 16px ${color}44` : "0 1px 4px rgba(30,46,40,.06)",
        transition: "box-shadow .2s",
      }}>
      {/* Dot statut */}
      <div style={{ position: "absolute", top: isBar ? 4 : 6, right: isBar ? 4 : 6,
        width: 8, height: 8, borderRadius: "50%", background: color }} />
      <div style={{ fontSize: isBar ? 11 : 12, fontWeight: 700, color, lineHeight: 1 }}>
        {table.label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2,
        fontSize: 10, color: MUTED }}>
        <Users size={9} /> {table.capacity}p
      </div>
    </motion.div>
  );
}

/* ── QR Code téléchargeable ── */
function TableQR({ url, label }) {
  const download = () => {
    const svg  = document.getElementById(`qr-table-${label}`);
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `qr-table-${label}.svg`;
    a.click();
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ background: "white", padding: 10, borderRadius: 10,
        border: `0.5px solid ${BORDER}`, display: "inline-block", marginBottom: 8 }}>
        <QRCode id={`qr-table-${label}`} value={url} size={120} fgColor={DARK} bgColor="white" />
      </div>
      <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace",
        marginBottom: 8, wordBreak: "break-all" }}>{url}</div>
      <Btn icon={Download} onClick={download} style={{ margin: "0 auto", fontSize: 11 }}>
        Télécharger SVG
      </Btn>
    </div>
  );
}

export default function RestPlanSalle() {
  const { user } = useAuth();
  const [tables,      setTables]      = useState([]);
  const [restoSlug,   setRestoSlug]   = useState("");
  const [selected,    setSelected]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [configMode,  setConfigMode]  = useState(false);
  const [showQR,      setShowQR]      = useState(false);
  const [modalTable,  setModalTable]  = useState(false);
  const [editTable,   setEditTable]   = useState(null);
  const [form, setForm] = useState({ label: "", capacity: 2, zone: "interieur", status: "libre" });

  useEffect(() => {
    if (!user?.resto_id) { setLoading(false); return; }
    restaurantsService.getManage(user.resto_id)
      .then(d => {
        setTables(d.restaurant?.tables || []);
        setRestoSlug(d.restaurant?.slug || "");
      })
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
  const openEdit = (t)  => { setEditTable(t); setForm({ label: t.label, capacity: t.capacity, zone: t.zone || "interieur", status: t.status || "libre" }); setModalTable(true); };

  const zones    = [...new Set(tables.map(t => t.zone || "interieur"))];
  const libres   = tables.filter(t => ["libre","free"].includes(t.status)).length;
  const occupees = tables.filter(t => ["occupé","occupied"].includes(t.status)).length;
  const reservees = tables.filter(t => ["réservé","reserved"].includes(t.status)).length;

  const tableQrUrl = (t) =>
    `${window.location.origin}/menu/${restoSlug}?table=${encodeURIComponent(t.label)}`;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <PageTitle title="Plan de salle" subtitle="Vue 2D · Gestion des tables en temps réel" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn icon={Settings} variant={configMode ? "primary" : "default"}
              onClick={() => { setConfigMode(p => !p); setSelected(null); }}>
              {configMode ? "Vue normale" : "Configurer"}
            </Btn>
            <Btn variant="primary" icon={Plus} onClick={openNew}>Nouvelle table</Btn>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Libres",    val: libres,          color: S },
          { label: "Occupées",  val: occupees,        color: "#DC2626" },
          { label: "Réservées", val: reservees,       color: "#C47D1A" },
          { label: "Total",     val: tables.length,   color: DARK },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "white", border: `0.5px solid ${BORDER}`,
            borderRadius: 12, padding: "10px 14px", display: "flex",
            alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: MUTED }}>{s.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      {/* Légende couleurs */}
      <motion.div variants={fadeUp}
        style={{ display: "flex", gap: 14, marginBottom: 14, fontSize: 11, color: MUTED, flexWrap: "wrap" }}>
        {[["Libre", S], ["Réservée", "#C47D1A"], ["Occupée", "#DC2626"]].map(([l, c]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />
            {l}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED }}>
          Cliquez sur une table pour changer son statut ou générer son QR
        </span>
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
        zones.map(zone => {
          const zt = tables.filter(t => (t.zone || "interieur") === zone);
          if (!zt.length) return null;
          return (
            <motion.div key={zone} variants={fadeUp} style={{ marginBottom: 14 }}>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 16 }}>{ZONE_ICONS[zone] || "🪑"}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>
                    {ZONE_LABELS[zone] || zone}
                  </span>
                  <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto" }}>
                    {zt.filter(t => ["libre","free"].includes(t.status)).length}/{zt.length} libres
                  </span>
                </div>

                {/* 2D canvas */}
                <div style={{
                  minHeight: 120,
                  background: BG,
                  borderRadius: 12,
                  padding: "20px 16px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                  alignItems: "flex-start",
                  position: "relative",
                  border: `0.5px solid ${BORDER}`,
                }}>
                  {zt.map(t => (
                    <div key={t.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <TableShape
                        table={t}
                        selected={selected}
                        onClick={() => {
                          if (configMode) { openEdit(t); return; }
                          setSelected(prev => prev?.id === t.id ? null : t);
                          setShowQR(false);
                        }}
                      />
                      {configMode && (
                        <button onClick={() => deleteTable(t.id)}
                          style={{ border: "none", background: "transparent",
                            cursor: "pointer", color: "#FECACA", display: "flex",
                            alignItems: "center", gap: 2, fontSize: 10, fontFamily: FONT }}>
                          <Trash2 size={10} />Supp.
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          );
        })
      )}

      {/* ── Drawer table sélectionnée ── */}
      <AnimatePresence>
        {selected && !configMode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setShowQR(false); }}
              style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.2)", zIndex: 40 }} />

            <motion.div initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320,
                background: "white", zIndex: 50, padding: "24px 22px", fontFamily: FONT,
                boxShadow: "-4px 0 24px rgba(0,0,0,.1)", overflowY: "auto" }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: DARK }}>
                    Table {selected.label}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {ZONE_LABELS[selected.zone] || selected.zone} · {selected.capacity} pers.
                  </div>
                </div>
                <button onClick={() => { setSelected(null); setShowQR(false); }}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: MUTED }}>
                  <X size={18} />
                </button>
              </div>

              {/* Statut actuel */}
              <div style={{ marginBottom: 20 }}>
                <Badge label={STL[selected.status] || selected.status}
                  variant={STB[selected.status] || "gray"} />
              </div>

              {/* Changer statut */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                  Changer le statut
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["libre","réservé","occupé"].filter(s => s !== selected.status).map(s => {
                    const c = STC[s];
                    return (
                      <button key={s} onClick={() => updateStatus(selected.id, s)}
                        style={{ padding: "10px 14px", borderRadius: 9, border: `0.5px solid ${c}55`,
                          background: c + "14", color: c, fontWeight: 600, fontSize: 13,
                          cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
                        Marquer comme {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QR Code par table */}
              <div style={{ paddingTop: 16, borderTop: `0.5px solid ${BORDER}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                  QR Code de la table
                </div>
                {!showQR ? (
                  <Btn icon={QrCode} onClick={() => setShowQR(true)}
                    style={{ width: "100%", justifyContent: "center" }}>
                    Afficher le QR Code
                  </Btn>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <TableQR url={tableQrUrl(selected)} label={selected.label} />
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.5,
                      textAlign: "center" }}>
                      Scannez ce QR pour accéder directement au menu depuis cette table
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Modifier */}
              <div style={{ marginTop: 16 }}>
                <Btn icon={Pencil} onClick={() => { setSelected(null); openEdit(selected); }}
                  style={{ width: "100%", justifyContent: "center" }}>
                  Modifier la table
                </Btn>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal créer / modifier table ── */}
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
