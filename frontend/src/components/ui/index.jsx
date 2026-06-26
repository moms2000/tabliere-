import { motion } from "framer-motion";

const G = "#1D9E75";

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style = {}, hover = false }) {
  const base = { background: "white", border: "0.5px solid #eee",
    borderRadius: 10, padding: "14px 16px", ...style };
  if (hover) return (
    <motion.div whileHover={{ y: -2, boxShadow: "0 4px 16px rgba(0,0,0,.06)" }}
      transition={{ duration: 0.15 }} style={base}>{children}</motion.div>
  );
  return <div style={base}>{children}</div>;
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, delta, up, icon: Icon, color = G }) {
  return (
    <motion.div whileHover={{ y: -2, boxShadow: "0 4px 16px rgba(0,0,0,.06)" }}
      transition={{ duration: 0.14 }}
      style={{ background: "white", border: "0.5px solid #eee", borderRadius: 10,
        padding: "12px 14px", cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: color + "18",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Icon && <Icon size={17} color={color} />}
        </div>
        {delta && (
          <span style={{ fontSize: 11, fontWeight: 500, color: up ? G : "#D85A30" }}>
            {up ? "↑" : "↓"} {delta}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#1a1a1a", marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
    </motion.div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_STYLES = {
  green:  { bg: "#E1F5EE", color: "#0F6E56" },
  amber:  { bg: "#FAEEDA", color: "#854F0B" },
  red:    { bg: "#FAECE7", color: "#993C1D" },
  blue:   { bg: "#E6F1FB", color: "#185FA5" },
  gray:   { bg: "#F1EFE8", color: "#5F5E5A" },
};
export function Badge({ label, variant = "gray" }) {
  const s = BADGE_STYLES[variant] || BADGE_STYLES.gray;
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 9px",
      borderRadius: 10, background: s.bg, color: s.color }}>{label}</span>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ value, onChange }) {
  return (
    <motion.div onClick={() => onChange(!value)}
      animate={{ background: value ? G : "#ddd" }}
      style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer",
        position: "relative", flexShrink: 0 }}>
      <motion.div animate={{ x: value ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ width: 16, height: 16, borderRadius: "50%", background: "white",
          position: "absolute", top: 2 }} />
    </motion.div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = "default", style = {}, icon: Icon }) {
  const variants = {
    default: { border: "0.5px solid #e0e0e0", background: "white", color: "#555" },
    primary: { border: "none", background: G, color: "white" },
    danger:  { border: "0.5px solid #FAECE7", background: "#FAECE7", color: "#993C1D" },
  };
  return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8,
        padding: "6px 13px", cursor: "pointer", fontSize: 13, fontWeight: variant === "primary" ? 500 : 400,
        ...variants[variant], ...style }}>
      {Icon && <Icon size={14} />}{children}
    </motion.button>
  );
}

// ── SectionHeader ──────────────────────────────────────────────────────────────
export function SectionHeader({ title, icon: Icon, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "#222",
        display: "flex", alignItems: "center", gap: 7 }}>
        {Icon && <Icon size={17} color={G} />}{title}
      </h2>
      {action}
    </div>
  );
}

// ── PageTitle ─────────────────────────────────────────────────────────────────
export function PageTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", marginBottom: 2 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: "#888" }}>{subtitle}</p>}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ columns, rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
          {columns.map(c => (
            <th key={c.key} style={{ textAlign: c.align || "left", padding: "6px 8px",
              color: "#aaa", fontWeight: 500, fontSize: 11 }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <motion.tr key={i} whileHover={{ background: "#fafff9" }}
            style={{ borderBottom: "0.5px solid #f8f8f8" }}>
            {columns.map(c => (
              <td key={c.key} style={{ padding: "8px 8px", textAlign: c.align || "left",
                verticalAlign: "middle" }}>
                {c.render ? c.render(row) : row[c.key]}
              </td>
            ))}
          </motion.tr>
        ))}
      </tbody>
    </table>
  );
}
