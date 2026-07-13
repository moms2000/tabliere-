import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import {
  LayoutTemplate, Users, Plus, Pencil, Trash2,
  Settings, QrCode, Download, X, Move, Clock, CalendarDays,
} from "lucide-react";
import { Card, PageTitle, Badge, Btn, Modal, FormField, Input, Select } from "../../components/ui";
import { useNavigate } from "react-router-dom";
import { restaurantsService } from "../../services/restaurants.service.js";
import { reservationsService } from "../../services/reservations.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

const _FREE = { bg: "#E8F5EE", border: "#3D6B55", dot: "#3D6B55", shadow: "rgba(61,107,85,0.35)", badge: "green" };
const _RESV = { bg: "#FEF6E4", border: "#C47D1A", dot: "#C47D1A", shadow: "rgba(196,125,26,0.35)", badge: "amber" };
const _OCCU = { bg: "#FEF2F2", border: "#DC2626", dot: "#DC2626", shadow: "rgba(220,38,38,0.35)", badge: "red" };
const STATUS_COLOR = {
  // clés DB (ENUM sans accent), françaises accentuées et anglaises — le backend
  // stocke 'libre'/'reserve'/'occupe' mais l'UI peut recevoir plusieurs formes
  libre: _FREE,    reserve: _RESV,  occupe: _OCCU,
  réservé: _RESV,  occupé: _OCCU,
  free: _FREE,     reserved: _RESV, occupied: _OCCU,
};
const STATUS_LABEL = {
  libre: "Libre", reserve: "Réservé", occupe: "Occupé",
  réservé: "Réservé", occupé: "Occupé",
  free: "Libre", reserved: "Réservé", occupied: "Occupé",
};
// Ramène n'importe quelle forme de statut vers la clé accentuée d'affichage
const canonStatus = (s) => ({
  libre: "libre", free: "libre",
  reserve: "réservé", reserved: "réservé", réservé: "réservé",
  occupe: "occupé", occupied: "occupé", occupé: "occupé",
}[s] || "libre");

const ZONE_META = {
  interieur: { label: "Salle intérieure", icon: "🪑", floor: "#EDE0CB" },
  terrasse:  { label: "Terrasse",          icon: "🌿", floor: "#D8EADC" },
  bar:        { label: "Bar / Comptoir",    icon: "🍸", floor: "#E4D9CC" },
  vip:        { label: "Espace VIP",       icon: "⭐", floor: "#E8E0EF" },
};

/* ── Parquet SVG background (inline data URI) ─────────────────── */
const parquetBg = `url("data:image/svg+xml,%3Csvg width='40' height='20' viewBox='0 0 40 20' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='20' height='10' fill='%23D4BA8A' rx='0'/%3E%3Crect x='20' y='0' width='20' height='10' fill='%23C9AE7E' rx='0'/%3E%3Crect x='0' y='10' width='20' height='10' fill='%23C9AE7E' rx='0'/%3E%3Crect x='20' y='10' width='20' height='10' fill='%23D4BA8A' rx='0'/%3E%3Cline x1='0' y1='10' x2='40' y2='10' stroke='%23BFA070' stroke-width='0.5'/%3E%3Cline x1='20' y1='0' x2='20' y2='20' stroke='%23BFA070' stroke-width='0.5'/%3E%3C/svg%3E")`;

/* ── Chairs rendered around table ─────────────────────────────── */
function Chairs({ cap, tw, th, isRound, color }) {
  const count = Math.min(cap, 12);
  const chairs = [];
  const cr = 8; // chair radius
  const gap = 7; // gap between table edge and chair

  if (isRound) {
    const tr = (Math.max(tw, th) / 2);
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      const dist = tr + gap + cr;
      const cx = tw / 2 + dist * Math.cos(angle);
      const cy = th / 2 + dist * Math.sin(angle);
      chairs.push(
        <div key={i} style={{
          position: "absolute",
          width: cr * 2, height: cr * 2,
          borderRadius: "50%",
          background: color + "55",
          border: `1.5px solid ${color}99`,
          left: cx - cr, top: cy - cr,
          boxShadow: `0 1px 3px rgba(0,0,0,0.15)`,
        }} />
      );
    }
  } else {
    // distribute around rectangle
    const perSide = Math.max(1, Math.round(count / 4));
    let placed = 0;
    const sides = [
      { axis: "x", from: 0, to: tw,   fixed: -gap - cr * 2, along: "left", perp: "top" },
      { axis: "x", from: 0, to: tw,   fixed: th + gap,      along: "left", perp: "top" },
      { axis: "y", from: 0, to: th,   fixed: -gap - cr * 2, along: "top",  perp: "left" },
      { axis: "y", from: 0, to: th,   fixed: tw + gap,      along: "top",  perp: "left" },
    ];
    for (const side of sides) {
      const n = Math.min(perSide, count - placed);
      if (n <= 0) break;
      const spacing = (side.to - side.from) / (n + 1);
      for (let i = 1; i <= n && placed < count; i++, placed++) {
        const pos = side.from + spacing * i;
        chairs.push(
          <div key={`${side.fixed}-${i}`} style={{
            position: "absolute",
            width: cr * 2, height: cr * 2,
            borderRadius: cr,
            background: color + "55",
            border: `1.5px solid ${color}99`,
            [side.along]: side.axis === "x" ? pos - cr : side.fixed,
            [side.perp]:  side.axis === "x" ? side.fixed : pos - cr,
            boxShadow: `0 1px 3px rgba(0,0,0,0.15)`,
          }} />
        );
      }
    }
  }
  return <>{chairs}</>;
}

/* ── 3D Table Component ────────────────────────────────────────── */
function Table3D({ table, selected, onClick, configMode, style, onPointerDown }) {
  const sc = STATUS_COLOR[table.status] || STATUS_COLOR.libre;
  const isBar = (table.zone || "interieur") === "bar";
  const isRound = isBar || (table.shape === "round");
  const isSel = selected?.id === table.id;

  const cap = table.capacity || 2;
  const tw = isRound ? 72 : cap <= 2 ? 72 : cap <= 4 ? 88 : 104;
  const th = isRound ? 72 : cap <= 2 ? 60 : cap <= 4 ? 72 : 72;
  const chairPad = 20;

  return (
    <div
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        width: tw + chairPad * 2,
        height: th + chairPad * 2,
        cursor: configMode ? "move" : "pointer",
        // En mode configuration : neutraliser le scroll tactile pour permettre
        // le glisser-déposer au doigt (mobile/tablette)
        touchAction: configMode ? "none" : "auto",
        ...style,
        userSelect: "none",
      }}>
      {/* Chaises/bulles retirées : le rendu autour des tables n'était pas fiable.
          On conserve chairPad pour ne pas décaler les positions enregistrées. */}

      {/* Table body */}
      <div style={{
        position: "absolute",
        left: chairPad, top: chairPad,
        width: tw, height: th,
        borderRadius: isRound ? "50%" : 10,
        background: `linear-gradient(145deg, ${sc.bg}, ${sc.bg}dd)`,
        border: `2px solid ${isSel ? DARK : sc.border}`,
        boxShadow: isSel
          ? `0 0 0 3px ${sc.dot}44, 0 6px 20px ${sc.shadow}, 0 2px 6px rgba(0,0,0,.18),
             inset 0 1px 0 rgba(255,255,255,.6)`
          : `0 4px 12px ${sc.shadow}, 0 2px 4px rgba(0,0,0,.12),
             inset 0 1px 0 rgba(255,255,255,.5)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 2, transition: "box-shadow .2s, transform .2s",
        transform: isSel ? "scale(1.05) translateY(-2px)" : "scale(1)",
      }}>
        {/* 3D top highlight */}
        <div style={{
          position: "absolute", top: 0, left: "8%", right: "8%",
          height: "38%",
          borderRadius: isRound ? "50% 50% 0 0 / 60% 60% 0 0" : "8px 8px 40% 40%",
          background: "rgba(255,255,255,0.22)",
          pointerEvents: "none",
        }} />

        {/* Status dot */}
        <div style={{
          position: "absolute", top: isRound ? 6 : 7, right: isRound ? 6 : 7,
          width: 8, height: 8, borderRadius: "50%",
          background: sc.dot,
          boxShadow: `0 0 5px ${sc.dot}`,
        }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: DARK, fontFamily: FONT, lineHeight: 1 }}>
          {table.label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9.5, color: MUTED, fontFamily: FONT }}>
          <Users size={8} />{cap}p
        </div>
      </div>
    </div>
  );
}

/* ── Draggable wrapper ─────────────────────────────────────────── */
function DraggableTable({ table, selected, onClick, configMode, canvasRef, onDragEnd }) {
  const dragging   = useRef(false);
  const moved      = useRef(false);          // a-t-on réellement glissé (vs simple tap) ?
  const startPtr   = useRef({ x: 0, y: 0 });
  const startPos   = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: table.pos_x || 20, y: table.pos_y || 20 }); // vraie position finale
  const [pos, setPos] = useState({ x: table.pos_x || 20, y: table.pos_y || 20 });

  // Pointer Events : unifie souris + tactile (mobile/tablette)
  const onPointerDown = (e) => {
    if (!configMode) return;
    e.stopPropagation();
    dragging.current = true;
    moved.current    = false;
    startPtr.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...currentPos.current };

    const onMove = (ev) => {
      if (!dragging.current) return;
      const dx = ev.clientX - startPtr.current.x;
      const dy = ev.clientY - startPtr.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nx = Math.max(0, Math.min(rect.width  - 140, startPos.current.x + dx));
      const ny = Math.max(0, Math.min(rect.height - 140, startPos.current.y + dy));
      currentPos.current = { x: nx, y: ny }; // ref = source de vérité (pas de course avec setState)
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      // Ne sauvegarder que si on a vraiment déplacé la table
      if (moved.current) onDragEnd(table.id, currentPos.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Resync si la position change côté serveur/parent
  useEffect(() => {
    const p = { x: table.pos_x || 20, y: table.pos_y || 20 };
    setPos(p);
    currentPos.current = p;
  }, [table.pos_x, table.pos_y]);

  return (
    <Table3D
      table={table}
      selected={selected}
      configMode={configMode}
      // Supprimer le clic uniquement après un vrai glissé (sinon un simple tap édite)
      onClick={(e) => { if (!moved.current) onClick(e); }}
      style={{
        left: pos.x, top: pos.y,
        cursor: configMode ? "grab" : "pointer",
      }}
      onPointerDown={onPointerDown}
    />
  );
}

/* ── QR download ───────────────────────────────────────────────── */
function TableQR({ url, label }) {
  // Télécharge le QR en IMAGE (PNG) : on dessine le SVG affiché sur un canvas
  // haute résolution puis on exporte en PNG.
  const download = () => {
    const svg = document.getElementById(`qr-tbl-${label}`);
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const SIZE = 720; // marge blanche incluse
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, SIZE, SIZE);
      const pad = 48;
      ctx.drawImage(img, pad, pad, SIZE - pad * 2, SIZE - pad * 2);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = Object.assign(document.createElement("a"), {
          href: URL.createObjectURL(blob), download: `qr-table-${label}.png`,
        });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, "image/png");
    };
    img.onerror = () => URL.revokeObjectURL(svgUrl);
    img.src = svgUrl;
  };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ background: "white", padding: 12, borderRadius: 12,
        border: `0.5px solid ${BORDER}`, display: "inline-block", marginBottom: 10,
        boxShadow: "0 2px 12px rgba(0,0,0,.07)" }}>
        <QRCode id={`qr-tbl-${label}`} value={url} size={130} fgColor={DARK} bgColor="white" />
      </div>
      <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace",
        marginBottom: 10, wordBreak: "break-all", padding: "0 8px" }}>{url}</div>
      <Btn icon={Download} onClick={download} style={{ margin: "0 auto", fontSize: 11 }}>
        Télécharger le QR (PNG)
      </Btn>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════ */
export default function RestPlanSalle() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [tables,     setTables]     = useState([]);
  const [restoSlug,  setRestoSlug]  = useState("");
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [configMode, setConfigMode] = useState(false);
  const [showQR,     setShowQR]     = useState(false);
  const [activeZone, setActiveZone] = useState("interieur");
  const [modalTable, setModalTable] = useState(false);
  const [editTable,  setEditTable]  = useState(null);
  const [form, setForm] = useState({ label: "", capacity: 2, zone: "interieur", status: "libre" });

  useEffect(() => {
    if (!user?.resto_id) { setLoading(false); return; }
    restaurantsService.getManage(user.resto_id)
      .then(d => {
        const raw = d.restaurant?.tables || [];
        // Assign default positions if missing
        const positioned = raw.map((t, i) => ({
          ...t,
          pos_x: t.pos_x ?? (40 + (i % 5) * 145),
          pos_y: t.pos_y ?? (30 + Math.floor(i / 5) * 145),
        }));
        setTables(positioned);
        setRestoSlug(d.restaurant?.slug || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.resto_id]);

  // Réservations du resto : pour afficher, dans la sidebar d'une table, tous
  // les créneaux réservés (une table peut être réservée 12h, 15h, 21h…).
  const [reservations, setReservations] = useState([]);
  useEffect(() => {
    if (!user?.resto_id) return;
    reservationsService.list({ limit: 500 })
      .then(res => setReservations(res.data || []))
      .catch(() => {});
  }, [user?.resto_id]);

  const CANCELLED = ["annule", "annulé", "cancelled"];
  const isSameDay = (d) => {
    const x = new Date(d), n = new Date();
    return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
  };
  // Réservations d'AUJOURD'HUI seulement pour la table sélectionnée (hors annulées),
  // triées par heure. Le jour où on est lundi → uniquement les résas du lundi, etc.
  const tableResas = selected
    ? reservations
        .filter(r => r.table_id === selected.id && !CANCELLED.includes(r.status) && isSameDay(r.reserved_at))
        .sort((a, b) => new Date(a.reserved_at) - new Date(b.reserved_at))
    : [];
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
  const todayLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });

  const updateStatus = async (tableId, newStatus) => {
    try {
      await restaurantsService.updateTable(user.resto_id, tableId, { status: newStatus });
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
      setSelected(prev => prev?.id === tableId ? { ...prev, status: newStatus } : prev);
    } catch (e) { console.error(e); }
  };

  const handleDragEnd = useCallback(async (tableId, newPos) => {
    let previous = null;
    setTables(prev => prev.map(t => {
      if (t.id === tableId) { previous = { pos_x: t.pos_x, pos_y: t.pos_y }; return { ...t, pos_x: newPos.x, pos_y: newPos.y }; }
      return t;
    }));
    try {
      await restaurantsService.updateTable(user.resto_id, tableId, { pos_x: Math.round(newPos.x), pos_y: Math.round(newPos.y) });
    } catch (e) {
      console.error("Échec sauvegarde position table", e);
      // Revenir à l'ancienne position pour rester cohérent avec le serveur
      if (previous) setTables(prev => prev.map(t => t.id === tableId ? { ...t, ...previous } : t));
    }
  }, [user?.resto_id]);

  const saveTable = async () => {
    try {
      if (editTable) {
        await restaurantsService.updateTable(user.resto_id, editTable.id, form);
        setTables(prev => prev.map(t => t.id === editTable.id ? { ...t, ...form } : t));
      } else {
        const zoneTablesCount = tables.filter(t => (t.zone || "interieur") === form.zone).length;
        const px = 40 + (zoneTablesCount % 5) * 145;
        const py = 30 + Math.floor(zoneTablesCount / 5) * 145;
        const res = await restaurantsService.createTable(user.resto_id, { ...form, pos_x: px, pos_y: py }).catch(() => null);
        const n = res?.table || { id: Date.now(), ...form, pos_x: px, pos_y: py };
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

  const openNew  = () => { setEditTable(null); setForm({ label: "", capacity: 2, zone: activeZone, status: "libre" }); setModalTable(true); };
  const openEdit = (t)  => { setEditTable(t); setForm({ label: t.label, capacity: t.capacity, zone: t.zone || "interieur", status: t.status || "libre" }); setModalTable(true); };

  const zones = [...new Set(["interieur", ...tables.map(t => t.zone || "interieur")])];
  const zoneTables = tables.filter(t => (t.zone || "interieur") === activeZone);
  const libres   = tables.filter(t => ["libre","free"].includes(t.status)).length;
  const occupees = tables.filter(t => ["occupe","occupé","occupied"].includes(t.status)).length;
  const reservees = tables.filter(t => ["reserve","réservé","reserved"].includes(t.status)).length;
  const zm = ZONE_META[activeZone] || ZONE_META.interieur;

  const tableQrUrl = (t) =>
    `${window.location.origin}/menu/${restoSlug}?table=${encodeURIComponent(t.label)}`;

  return (
    <div style={{ fontFamily: FONT }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <PageTitle title="Plan de salle" subtitle="Plan interactif · Glissez les tables pour les repositionner" />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn icon={Move} variant={configMode ? "primary" : "default"}
            onClick={() => { setConfigMode(p => !p); setSelected(null); }}>
            {configMode ? "Terminer" : "Repositionner"}
          </Btn>
          <Btn variant="primary" icon={Plus} onClick={openNew}>Nouvelle table</Btn>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Tables libres",    val: libres,         color: S,       bg: "#E8F5EE" },
          { label: "Occupées",         val: occupees,       color: "#DC2626", bg: "#FEF2F2" },
          { label: "Réservées",        val: reservees,      color: "#C47D1A", bg: "#FEF6E4" },
          { label: "Total tables",     val: tables.length,  color: DARK,     bg: "#F8F5EF" },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, background: s.bg,
            border: `1.5px solid ${s.color}22`,
            borderRadius: 14, padding: "12px 16px",
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>{s.label}</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* ── Zone tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {zones.map(z => {
          const m = ZONE_META[z] || { label: z, icon: "🪑" };
          const active = z === activeZone;
          return (
            <button key={z}
              onClick={() => { setActiveZone(z); setSelected(null); setShowQR(false); }}
              style={{
                padding: "7px 16px", borderRadius: 10, fontFamily: FONT,
                border: active ? `1.5px solid ${DARK}` : `1.5px solid ${BORDER}`,
                background: active ? DARK : "white",
                color: active ? "white" : MUTED,
                fontWeight: active ? 700 : 500, fontSize: 12,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "all .15s",
              }}>
              <span>{m.icon}</span>
              {m.label}
              <span style={{
                background: active ? "rgba(255,255,255,.2)" : BG,
                borderRadius: 8, padding: "1px 7px", fontSize: 11, fontWeight: 600,
              }}>
                {tables.filter(t => (t.zone || "interieur") === z).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Floor canvas ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: MUTED, fontSize: 13 }}>Chargement…</div>
      ) : (
        <div style={{
          borderRadius: 18, overflow: "hidden",
          boxShadow: "0 8px 40px rgba(30,46,40,.12), 0 2px 8px rgba(0,0,0,.08)",
          border: `1.5px solid ${BORDER}`,
          position: "relative",
        }}>
          {/* Zone header bar */}
          <div style={{
            background: DARK, padding: "12px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>{zm.icon}</span>
              <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{zm.label}</span>
              <span style={{
                background: "rgba(255,255,255,.12)", borderRadius: 8,
                padding: "2px 10px", fontSize: 11, color: "rgba(255,255,255,.7)",
              }}>
                {zoneTables.filter(t => ["libre","free"].includes(t.status)).length} / {zoneTables.length} libres
              </span>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 14 }}>
              {[["Libre","#3D6B55"],["Réservé","#C47D1A"],["Occupé","#DC2626"]].map(([l,c]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,.65)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", boxShadow: `0 0 6px ${c}` }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* The floor */}
          <div
            ref={canvasRef}
            style={{
              minHeight: 480,
              position: "relative",
              backgroundImage: parquetBg,
              backgroundSize: "40px 20px",
              overflow: "hidden",
            }}>
            {/* Overlay tint for zone */}
            <div style={{
              position: "absolute", inset: 0,
              background: `${zm.floor}88`,
              pointerEvents: "none",
            }} />

            {/* Wall shadows (depth feel) */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 18,
              background: "linear-gradient(to bottom, rgba(30,46,40,.12), transparent)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 18,
              background: "linear-gradient(to top, rgba(30,46,40,.1), transparent)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 12,
              background: "linear-gradient(to right, rgba(30,46,40,.1), transparent)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 12,
              background: "linear-gradient(to left, rgba(30,46,40,.1), transparent)", pointerEvents: "none" }} />

            {/* Mode hint */}
            {configMode && (
              <div style={{
                position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                background: DARK + "EE", color: "white", borderRadius: 20,
                padding: "5px 14px", fontSize: 11, fontWeight: 600, zIndex: 10,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <Move size={11} /> Glissez les tables pour les repositionner
              </div>
            )}

            {zoneTables.length === 0 ? (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 12,
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: PL,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <LayoutTemplate size={26} color={P} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>
                  Aucune table dans cette zone
                </div>
                <Btn variant="primary" icon={Plus} onClick={openNew} style={{ margin: "0 auto" }}>
                  Ajouter une table
                </Btn>
              </div>
            ) : (
              zoneTables.map(t => (
                <DraggableTable
                  key={t.id}
                  table={t}
                  selected={selected}
                  configMode={configMode}
                  canvasRef={canvasRef}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (configMode) { openEdit(t); return; }
                    setSelected(prev => prev?.id === t.id ? null : t);
                    setShowQR(false);
                  }}
                />
              ))
            )}
          </div>

          {/* Config toolbar */}
          {configMode && (
            <div style={{
              background: "#1E2E28F5", padding: "10px 20px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.6)", flex: 1 }}>
                Mode configuration — Cliquez sur une table pour la modifier
              </span>
              {selected && (
                <>
                  <Btn icon={Pencil} onClick={() => openEdit(selected)}
                    style={{ fontSize: 11, background: "rgba(255,255,255,.1)", color: "white", border: "none" }}>
                    Modifier
                  </Btn>
                  <Btn icon={Trash2} onClick={() => deleteTable(selected.id)}
                    style={{ fontSize: 11, background: "rgba(220,38,38,.15)", color: "#DC2626", border: "none" }}>
                    Supprimer
                  </Btn>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Side drawer: table details ── */}
      <AnimatePresence>
        {selected && !configMode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setShowQR(false); }}
              style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.25)", zIndex: 40 }} />

            <motion.div initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              style={{
                position: "fixed", top: 0, right: 0, bottom: 0, width: 320,
                background: "white", zIndex: 50, padding: "24px 22px",
                fontFamily: FONT, boxShadow: "-4px 0 32px rgba(0,0,0,.12)",
                overflowY: "auto",
              }}>

              {/* Drawer header */}
              <div style={{ display: "flex", alignItems: "flex-start",
                justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>
                    Table {selected.label}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                    {ZONE_META[selected.zone]?.label || selected.zone} · {selected.capacity} pers.
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Badge
                      label={STATUS_LABEL[selected.status] || selected.status}
                      variant={(STATUS_COLOR[selected.status] || STATUS_COLOR.libre).badge} />
                  </div>
                </div>
                <button onClick={() => { setSelected(null); setShowQR(false); }}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: MUTED, marginTop: 2 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Réservations d'AUJOURD'HUI pour cette table (12h, 15h, 21h…).
                  Clic sur une résa → page Réservations, ligne ciblée surlignée. */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11,
                  fontWeight: 700, color: DARK, marginBottom: 10, textTransform: "capitalize" }}>
                  <CalendarDays size={13} color={P} /> {todayLabel}
                  {tableResas.length > 0 && (
                    <span style={{ color: MUTED, fontWeight: 500, textTransform: "none" }}>
                      · {tableResas.length} réservation{tableResas.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {tableResas.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: MUTED, padding: "12px", background: BG,
                    borderRadius: 10, textAlign: "center" }}>
                    Aucune réservation aujourd'hui sur cette table.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {tableResas.map(r => {
                      const v = r.status === "confirme" ? "green"
                        : r.status === "en_attente" ? "amber" : "gray";
                      return (
                        <button key={r.id}
                          onClick={() => navigate(`/restaurant/reservations?focus=${r.id}`)}
                          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
                            padding: "9px 12px", background: "white", border: `0.5px solid ${BORDER}`,
                            borderRadius: 10, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                            fontWeight: 800, color: P, minWidth: 54 }}>
                            <Clock size={12} /> {fmtTime(r.reserved_at)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: DARK, overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.client_name || "Client"}
                            </div>
                            <div style={{ fontSize: 11, color: MUTED, display: "flex", alignItems: "center", gap: 4 }}>
                              <Users size={10} /> {r.party_size} pers.
                            </div>
                          </div>
                          <Badge label={r.status} variant={v} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Change status */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                  Changer le statut
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {["libre","réservé","occupé"].filter(s => s !== canonStatus(selected.status)).map(s => {
                    const sc = STATUS_COLOR[s];
                    return (
                      <button key={s} onClick={() => updateStatus(selected.id, s)}
                        style={{
                          padding: "10px 16px", borderRadius: 10,
                          border: `1.5px solid ${sc.border}44`,
                          background: sc.bg, color: sc.dot,
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                          fontFamily: FONT, textAlign: "left",
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%",
                          background: sc.dot, flexShrink: 0 }} />
                        Marquer comme {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QR per table */}
              <div style={{ paddingTop: 18, borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                  QR Code de la table
                </div>
                {!showQR ? (
                  <Btn icon={QrCode} onClick={async () => {
                    setShowQR(true);
                    // Sauvegarder l'URL QR côté serveur
                    try {
                      await restaurantsService.generateTableQR(user.resto_id, selected.id);
                    } catch (_) {}
                  }}
                    style={{ width: "100%", justifyContent: "center" }}>
                    Générer le QR Code
                  </Btn>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <TableQR url={tableQrUrl(selected)} label={selected.label} />
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.6,
                      textAlign: "center" }}>
                      Ce QR amène le client directement sur le menu Table {selected.label}
                    </div>
                  </motion.div>
                )}
              </div>

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

      {/* ── Modal create/edit ── */}
      {modalTable && (
        <Modal open title={editTable ? "Modifier la table" : "Nouvelle table"}
          onClose={() => { setModalTable(false); setEditTable(null); }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <FormField label="Numéro / Label">
              <Input value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder="T-1, VIP-1…" />
            </FormField>
            <FormField label="Capacité (pers.)">
              <Input value={form.capacity} type="number" min={1} max={20}
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
          <FormField label="Statut">
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
    </div>
  );
}
