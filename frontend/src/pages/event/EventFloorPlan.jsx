import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Move, Pencil, Trash2, X, Crown, Armchair, Users } from "lucide-react";
import { Card, Btn, Modal, FormField, Input } from "../../components/ui";
import { eventsService } from "../../services/events.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", S = "#3D6B55";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";

const STATUS = {
  libre:  { bg: "#E8F5EE", border: "#3D6B55", dot: "#3D6B55", shadow: "rgba(61,107,85,.35)",  label: "Libre" },
  reserve:{ bg: "#FEF6E4", border: "#C47D1A", dot: "#C47D1A", shadow: "rgba(196,125,26,.35)", label: "Réservé" },
  occupe: { bg: "#FEF2F2", border: "#DC2626", dot: "#DC2626", shadow: "rgba(220,38,38,.35)",  label: "Occupé" },
};
const canon = (s) => (["reserve","réservé","reserved"].includes(s) ? "reserve" : ["occupe","occupé","occupied"].includes(s) ? "occupe" : "libre");

/* ── Table 3D (événement) ── */
function Table3D({ table, selected, onClick, configMode, style, onPointerDown }) {
  const sc = STATUS[canon(table.status)] || STATUS.libre;
  const isVip = table.kind === "vip";
  const cap = table.capacity || 2;
  const tw = isVip ? 104 : cap <= 2 ? 74 : cap <= 4 ? 90 : 104;
  const th = isVip ? 78 : cap <= 2 ? 62 : 74;
  const pad = 16;
  return (
    <div onClick={onClick} onPointerDown={onPointerDown}
      style={{ position: "absolute", width: tw + pad * 2, height: th + pad * 2,
        cursor: configMode ? "grab" : "pointer", touchAction: configMode ? "none" : "auto",
        ...style, userSelect: "none" }}>
      <div style={{ position: "absolute", left: pad, top: pad, width: tw, height: th,
        borderRadius: isVip ? 14 : 10, background: `linear-gradient(145deg, ${sc.bg}, ${sc.bg}dd)`,
        border: `2px solid ${selected ? DARK : sc.border}`,
        boxShadow: selected ? `0 0 0 3px ${sc.dot}44, 0 6px 20px ${sc.shadow}` : `0 4px 12px ${sc.shadow}, inset 0 1px 0 rgba(255,255,255,.5)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        transition: "box-shadow .2s, transform .2s", transform: selected ? "scale(1.05) translateY(-2px)" : "scale(1)" }}>
        <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: sc.dot, boxShadow: `0 0 5px ${sc.dot}` }} />
        {isVip && <Crown size={13} color="#C47D1A" style={{ position: "absolute", top: 6, left: 6 }} />}
        <div style={{ fontSize: 12, fontWeight: 800, color: DARK, fontFamily: FONT, lineHeight: 1 }}>{table.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9.5, color: MUTED, fontFamily: FONT }}>
          <Users size={9} />{cap}{isVip && table.price ? ` · ${fmt(table.price)}` : ""}
        </div>
      </div>
    </div>
  );
}

/* ── Table déplaçable ── */
function DraggableTable({ table, selected, onClick, configMode, canvasRef, onDragEnd }) {
  const dragging = useRef(false), moved = useRef(false);
  const startPtr = useRef({ x: 0, y: 0 }), startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: table.pos_x || 20, y: table.pos_y || 20 });
  const [pos, setPos] = useState({ x: table.pos_x || 20, y: table.pos_y || 20 });

  const onPointerDown = (e) => {
    if (!configMode) return;
    e.stopPropagation();
    dragging.current = true; moved.current = false;
    startPtr.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...currentPos.current };
    const onMove = (ev) => {
      if (!dragging.current) return;
      const dx = ev.clientX - startPtr.current.x, dy = ev.clientY - startPtr.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nx = Math.max(0, Math.min(rect.width - 140, startPos.current.x + dx));
      const ny = Math.max(0, Math.min(rect.height - 140, startPos.current.y + dy));
      currentPos.current = { x: nx, y: ny }; setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (moved.current) onDragEnd(table.id, currentPos.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  useEffect(() => {
    const p = { x: table.pos_x || 20, y: table.pos_y || 20 };
    setPos(p); currentPos.current = p;
  }, [table.pos_x, table.pos_y]);

  return (
    <Table3D table={table} selected={selected} configMode={configMode}
      onClick={(e) => { if (!moved.current) onClick(e); }}
      style={{ left: pos.x, top: pos.y, cursor: configMode ? "grab" : "pointer" }}
      onPointerDown={onPointerDown} />
  );
}

export default function EventFloorPlan({ event, tables, onChanged }) {
  const [configMode, setConfigMode] = useState(false);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [f, setF] = useState({ label: "", kind: "simple", capacity: 4, price: 0, description: "", min_order: 0 });
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  // positions par défaut si absentes (ou au défaut DB 20/20 → on étale pour éviter la superposition)
  const positioned = tables.map((t, i) => {
    const unset = t.pos_x == null || t.pos_y == null || (t.pos_x === 20 && t.pos_y === 20);
    return {
      ...t,
      pos_x: unset ? (30 + (i % 5) * 150) : t.pos_x,
      pos_y: unset ? (24 + Math.floor(i / 5) * 130) : t.pos_y,
    };
  });

  const libres  = tables.filter(t => canon(t.status) === "libre").length;
  const reserv  = tables.filter(t => canon(t.status) === "reserve").length;
  const occ     = tables.filter(t => canon(t.status) === "occupe").length;

  const handleDragEnd = useCallback(async (id, npos) => {
    try { await eventsService.updateTable(event.id, id, { pos_x: Math.round(npos.x), pos_y: Math.round(npos.y) }); await onChanged(); }
    catch (e) { console.error(e); }
  }, [event.id, onChanged]);

  const updateStatus = async (id, status) => {
    try { await eventsService.updateTable(event.id, id, { status }); setSelected(p => p ? { ...p, status } : p); await onChanged(); }
    catch (e) { console.error(e); }
  };
  const openNew = () => { setEditTable(null); setF({ label: "", kind: "simple", capacity: 4, price: 0, description: "", min_order: 0 }); setModal(true); };
  const openEdit = (t) => { setEditTable(t); setF({ label: t.label, kind: t.kind, capacity: t.capacity, price: t.price, description: t.description || "", min_order: t.min_order || 0 }); setModal(true); setSelected(null); };
  const save = async () => {
    if (!f.label) return;
    setSaving(true);
    try {
      const payload = { ...f, zone: "general", capacity: Number(f.capacity) || 1, price: Number(f.price) || 0, min_order: Number(f.min_order) || 0 };
      if (editTable) await eventsService.updateTable(event.id, editTable.id, payload);
      else {
        const n = tables.length;
        await eventsService.createTable(event.id, { ...payload, pos_x: 30 + (n % 5) * 150, pos_y: 24 + Math.floor(n / 5) * 130 });
      }
      setModal(false); await onChanged();
    } catch (e) { alert(e.response?.data?.message || "Erreur"); }
    finally { setSaving(false); }
  };
  const del = async (t) => {
    if (!window.confirm(`Retirer « ${t.label} » ?`)) return;
    try { await eventsService.deleteTable(event.id, t.id); setSelected(null); await onChanged(); } catch { alert("Erreur"); }
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: DARK }}>Plan de salle</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Plan interactif · glissez les tables pour les repositionner</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn icon={Move} variant={configMode ? "primary" : "default"} onClick={() => { setConfigMode(p => !p); setSelected(null); }}>
            {configMode ? "Terminer" : "Repositionner"}
          </Btn>
          <Btn variant="primary" icon={Plus} onClick={openNew}>Nouvelle table</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          ["Libres", libres, S, "#E8F5EE"],
          ["Réservées", reserv, "#C47D1A", "#FEF6E4"],
          ["Occupées", occ, "#DC2626", "#FEF2F2"],
          ["Total", tables.length, DARK, "#F8F5EF"],
        ].map(([l, v, c, bg], i) => (
          <div key={i} style={{ flex: 1, minWidth: 100, background: bg, border: `1.5px solid ${c}22`, borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: MUTED }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Canvas */}
      {tables.length === 0 ? (
        <Card><div style={{ textAlign: "center", padding: "44px 0", color: MUTED, fontSize: 13 }}>
          Aucune table. Cliquez « Nouvelle table » pour créer vos tables et packs VIP.
        </div></Card>
      ) : (
        <div style={{ borderRadius: 18, overflow: "hidden", border: `1.5px solid ${BORDER}`,
          boxShadow: "0 8px 40px rgba(30,46,40,.12)", position: "relative" }}>
          <div style={{ background: DARK, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{event.name}</span>
            <div style={{ display: "flex", gap: 14 }}>
              {[["Libre", "#3D6B55"], ["Réservé", "#C47D1A"], ["Occupé", "#DC2626"]].map(([l, c]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,.65)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} /> {l}
                </span>
              ))}
            </div>
          </div>
          <div ref={canvasRef} onClick={() => setSelected(null)}
            style={{ minHeight: 460, position: "relative",
              background: `repeating-linear-gradient(0deg, #EFE7D6 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, #EFE7D6 0 1px, transparent 1px 26px), #F3ECDD`,
              cursor: configMode ? "default" : "default" }}>
            {positioned.map(t => (
              <DraggableTable key={t.id} table={t} selected={selected?.id === t.id}
                configMode={configMode} canvasRef={canvasRef} onDragEnd={handleDragEnd}
                onClick={(e) => { e.stopPropagation(); if (!configMode) setSelected(t); }} />
            ))}
          </div>
        </div>
      )}

      {/* Drawer table sélectionnée */}
      <AnimatePresence>
        {selected && !configMode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.25)", zIndex: 40 }} />
            <motion.div initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320, background: "white", zIndex: 50,
                padding: "24px 22px", fontFamily: FONT, boxShadow: "-4px 0 32px rgba(0,0,0,.12)", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: DARK, display: "flex", alignItems: "center", gap: 6 }}>
                    {selected.kind === "vip" && <Crown size={16} color={P} />}{selected.label}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                    {selected.kind === "vip" ? "Pack VIP" : "Table"} · {selected.capacity} pers.{selected.price ? ` · ${fmt(selected.price)}` : ""}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: MUTED }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>Changer le statut</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {["libre", "reserve", "occupe"].filter(s => s !== canon(selected.status)).map(s => {
                    const sc = STATUS[s];
                    return (
                      <button key={s} onClick={() => updateStatus(selected.id, s)}
                        style={{ padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${sc.border}44`,
                          background: sc.bg, color: sc.dot, fontWeight: 600, fontSize: 13, cursor: "pointer",
                          fontFamily: FONT, textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot }} />
                        Marquer comme {sc.label.toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, paddingTop: 18, borderTop: `1px solid ${BORDER}` }}>
                <Btn icon={Pencil} onClick={() => openEdit(selected)} style={{ flex: 1, justifyContent: "center" }}>Modifier</Btn>
                <Btn icon={Trash2} variant="danger" onClick={() => del(selected)} style={{ flex: 1, justifyContent: "center" }}>Retirer</Btn>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modale ajout / édition */}
      <Modal open={modal} title={editTable ? "Modifier" : "Nouvelle table / pack VIP"} onClose={() => setModal(false)}>
        <FormField label="Type">
          <div style={{ display: "flex", gap: 8 }}>
            {[["simple", "Table simple", Armchair], ["vip", "Pack VIP", Crown]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => set("kind", k)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  border: `1.5px solid ${f.kind === k ? P : BORDER}`, borderRadius: 10, padding: "10px 0",
                  background: f.kind === k ? "#FEF6EC" : "white", cursor: "pointer", fontFamily: FONT,
                  color: f.kind === k ? "#C47D1A" : DARK, fontSize: 13, fontWeight: 600 }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormField label="Libellé"><Input value={f.label} onChange={e => set("label", e.target.value)} placeholder={f.kind === "vip" ? "Carré VIP 1" : "Table 1"} /></FormField>
          <FormField label="Capacité (pers.)"><Input type="number" value={f.capacity} onChange={e => set("capacity", e.target.value)} placeholder="4" /></FormField>
        </div>
        <FormField label={f.kind === "vip" ? "Prix du pack (FCFA)" : "Prix (FCFA, 0 = gratuit)"}>
          <Input type="number" value={f.price} onChange={e => set("price", e.target.value)} placeholder={f.kind === "vip" ? "150000" : "0"} />
        </FormField>
        {f.kind === "vip" && (
          <>
            <FormField label="Contenu du pack (optionnel)">
              <textarea value={f.description} onChange={e => set("description", e.target.value)} rows={2}
                placeholder="Ex : 1 bouteille de champagne offerte, service dédié…"
                style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px",
                  fontSize: 13, background: BG, outline: "none", fontFamily: FONT, resize: "vertical", boxSizing: "border-box", color: DARK }} />
            </FormField>
            <FormField label="Minimum de commande (FCFA, 0 = aucun)">
              <Input type="number" value={f.min_order} onChange={e => set("min_order", e.target.value)} placeholder="Ex : 300000" />
            </FormField>
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn onClick={() => setModal(false)}>Annuler</Btn>
          <Btn variant="primary" onClick={save} disabled={!f.label || saving}>{saving ? "…" : editTable ? "Enregistrer" : "Ajouter"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
