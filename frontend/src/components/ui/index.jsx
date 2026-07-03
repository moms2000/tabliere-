import React from "react";
import { motion } from "framer-motion";

/* ── Design tokens TablièreCI ────────────────────────────────────────────────── */
const P    = "#E8A045";   // or pêche — primaire
const PL   = "#FEF6EC";   // or pêche clair
const S    = "#3D6B55";   // sauge
const DARK = "#1E2E28";   // forêt
const BG   = "#F8F5EF";   // sable
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style = {}, hover = false }) {
  const base = {
    background: "white", border: `0.5px solid ${BORDER}`,
    borderRadius: 12, padding: "14px 16px", fontFamily: FONT, ...style,
  };
  if (hover) return (
    <motion.div whileHover={{ y: -2, boxShadow: "0 4px 16px rgba(30,46,40,.07)" }}
      transition={{ duration: 0.15 }} style={base}>{children}</motion.div>
  );
  return <div style={base}>{children}</div>;
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, delta, up, icon: Icon, color = P }) {
  return (
    <motion.div whileHover={{ y: -2, boxShadow: "0 4px 16px rgba(30,46,40,.07)" }}
      transition={{ duration: 0.14 }}
      style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12,
        padding: "12px 14px", cursor: "default", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: color + "18",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Icon && <Icon size={17} color={color} />}
        </div>
        {delta && (
          <span style={{ fontSize: 11, fontWeight: 500, color: up ? S : "#DC2626" }}>
            {up ? "↑" : "↓"} {delta}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: DARK, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
    </motion.div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_STYLES = {
  green:  { bg: "#F0F6F2", color: S },
  amber:  { bg: PL,        color: "#C47D1A" },
  red:    { bg: "#FEF2F2", color: "#DC2626" },
  blue:   { bg: "#EFF6FF", color: "#2563EB" },
  gray:   { bg: BG,        color: MUTED },
  gold:   { bg: PL,        color: P },
};
export function Badge({ label, variant = "gray" }) {
  const s = BADGE_STYLES[variant] || BADGE_STYLES.gray;
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 9px",
      borderRadius: 10, background: s.bg, color: s.color, fontFamily: FONT }}>{label}</span>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ value, onChange }) {
  return (
    <motion.div onClick={() => onChange(!value)}
      animate={{ background: value ? P : BORDER }}
      style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer",
        position: "relative", flexShrink: 0 }}>
      <motion.div animate={{ x: value ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ width: 16, height: 16, borderRadius: "50%", background: "white",
          position: "absolute", top: 2, boxShadow: "0 1px 3px rgba(0,0,0,.15)" }} />
    </motion.div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = "default", style = {}, icon: Icon, disabled = false }) {
  const variants = {
    default:  { border: `0.5px solid ${BORDER}`, background: "white",    color: DARK },
    primary:  { border: "none", background: P,    color: "#1A1000" },
    secondary:{ border: `0.5px solid ${S}33`,     background: "#F0F6F2", color: S },
    danger:   { border: `0.5px solid #FECACA`,    background: "#FEF2F2", color: "#DC2626" },
  };
  return (
    <motion.button whileTap={{ scale: disabled ? 1 : 0.96 }} onClick={disabled ? undefined : onClick}
      style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8,
        padding: "7px 14px", cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13, fontWeight: variant === "primary" ? 600 : 400,
        opacity: disabled ? 0.5 : 1, fontFamily: FONT,
        ...variants[variant], ...style }}>
      {Icon && <Icon size={14} />}{children}
    </motion.button>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, icon: Icon, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: DARK, fontFamily: FONT,
        display: "flex", alignItems: "center", gap: 7 }}>
        {Icon && <Icon size={17} color={P} />}{title}
      </h2>
      {action}
    </div>
  );
}

// ── PageTitle ─────────────────────────────────────────────────────────────────
export function PageTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 18, fontFamily: FONT }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: DARK, marginBottom: 2 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: MUTED }}>{subtitle}</p>}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ columns, rows, onRowClick }) {
  return (
    <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
    <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 13, fontFamily: FONT }}>
      <thead>
        <tr style={{ borderBottom: `0.5px solid ${BORDER}` }}>
          {columns.map(c => (
            <th key={c.key} style={{ textAlign: c.align || "left", padding: "6px 8px",
              color: MUTED, fontWeight: 600, fontSize: 10,
              textTransform: "uppercase", letterSpacing: "0.8px" }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <motion.tr key={row.id || i}
            whileHover={{ background: PL }}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{ borderBottom: `0.5px solid ${BG}`,
              cursor: onRowClick ? "pointer" : "default" }}>
            {columns.map(c => (
              <td key={c.key} style={{ padding: "9px 8px", textAlign: c.align || "left",
                verticalAlign: "middle" }}>
                {c.render ? c.render(row) : row[c.key]}
              </td>
            ))}
          </motion.tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

// ── DateFilter (filtre jour/mois/année) ───────────────────────────────────────
export function DateFilter({ value, onChange }) {
  const modes = ["Tout", "Jour", "Mois", "Année"];
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {modes.map(m => (
        <button key={m} onClick={() => onChange(m)}
          style={{ fontSize: 11, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
            border: `0.5px solid ${value === m ? P : BORDER}`,
            background: value === m ? PL : "white",
            color: value === m ? "#C47D1A" : MUTED,
            fontWeight: value === m ? 600 : 400, fontFamily: FONT }}>
          {m}
        </button>
      ))}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
// NOTE: On utilise un div statique pour le centrage (flexbox) et motion.div
// uniquement pour l'animation — évite le conflit framer-motion / translate CSS.
export function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.35)", zIndex: 100 }} />
      {/* Centrage via flexbox — ne peut pas être écrasé par framer-motion */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 101,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", pointerEvents: "none",
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          style={{
            background: "white", borderRadius: 16, padding: 24,
            width: "100%", maxWidth: width,
            maxHeight: "90vh", overflowY: "auto",
            fontFamily: FONT, boxShadow: "0 24px 64px rgba(30,46,40,.18)",
            pointerEvents: "auto",
          }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: DARK, margin: 0 }}>{title}</h2>
            <button onClick={onClose} style={{ border: "none", background: "transparent",
              cursor: "pointer", color: MUTED, fontSize: 24, lineHeight: 1, padding: 0 }}>×</button>
          </div>
          {children}
        </motion.div>
      </div>
    </>
  );
}

// ── FormField ─────────────────────────────────────────────────────────────────
export function FormField({ label, children, error }) {
  return (
    <div style={{ marginBottom: 14, fontFamily: FONT }}>
      {label && <label style={{ display: "block", fontSize: 10, fontWeight: 700,
        color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.8px" }}>
        {label}
      </label>}
      {children}
      {error && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ value, onChange, placeholder, type = "text", style = {} }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} type={type}
      style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
        padding: "9px 12px", fontSize: 13, color: DARK, background: BG,
        outline: "none", fontFamily: FONT, boxSizing: "border-box", ...style }} />
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ value, onChange, options, style = {} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
        padding: "9px 12px", fontSize: 13, color: DARK, background: BG,
        outline: "none", fontFamily: FONT, cursor: "pointer", ...style }}>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── PhotoUpload — sélecteur de photo depuis l'appareil ────────────────────────
// Usage: <PhotoUpload value={url} onChange={base64orUrl => ...} label="Photo" />
export function PhotoUpload({ value, onChange, label = "Photo", height = 120 }) {
  const inputRef = React.useRef(null);

  const compress = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else       { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await compress(file);
    onChange(b64);
    e.target.value = "";
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, marginBottom: 6,
          textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</div>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        style={{ height, borderRadius: 10, border: `1.5px dashed ${BORDER}`,
          background: value ? "transparent" : BG, cursor: "pointer", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative" }}>
        {value ? (
          <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center", color: MUTED }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>📷</div>
            <div style={{ fontSize: 11 }}>Choisir une photo</div>
          </div>
        )}
        {value && (
          <div style={{ position: "absolute", bottom: 6, right: 6,
            background: "rgba(0,0,0,.55)", borderRadius: 6, padding: "3px 8px",
            fontSize: 10, color: "white", cursor: "pointer" }}>
            Changer
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={handleFile} />
    </div>
  );
}
