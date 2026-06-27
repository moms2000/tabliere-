import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Utensils, Users, CalendarCheck, CreditCard,
  Activity, Settings, QrCode, Bell, RefreshCw, ChevronRight, X, LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={P} />
      <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
      <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
      <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
        stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

const NAV = [
  { to: "/admin",               label: "Vue d'ensemble",  icon: LayoutDashboard, end: true },
  { to: "/admin/restaurateurs", label: "Restaurateurs",   icon: Utensils },
  { to: "/admin/utilisateurs",  label: "Utilisateurs",    icon: Users },
  { to: "/admin/reservations",  label: "Réservations",    icon: CalendarCheck },
  { to: "/admin/finances",      label: "Finances",        icon: CreditCard },
  { to: "/admin/qr-themes",     label: "QR & Thèmes",     icon: QrCode },
  { to: "/admin/systeme",       label: "Système",         icon: Activity },
  { to: "/admin/parametres",    label: "Paramètres",      icon: Settings },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate   = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div style={{ display: "flex", height: "100vh", background: BG,
      overflow: "hidden", fontFamily: FONT }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 58 : 220 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        style={{ background: DARK, display: "flex", flexDirection: "column",
          overflow: "hidden", flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "13px 14px", borderBottom: "0.5px solid rgba(255,255,255,.07)", minHeight: 54 }}>
          <div onClick={() => navigate("/admin")} style={{ flexShrink: 0, cursor: "pointer" }}>
            <Logo size={28} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "white", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                  Tablière<span style={{ color: P }}>CI</span>
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.3)", letterSpacing: "1px",
                  textTransform: "uppercase", marginTop: 2 }}>Administration</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={{ textDecoration: "none" }}>
              {({ isActive }) => (
                <motion.div whileHover={{ background: "rgba(232,160,69,.10)" }}
                  style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", borderRadius: 9, marginBottom: 1,
                    background: isActive ? "rgba(232,160,69,.15)" : "transparent",
                    borderLeft: isActive ? `3px solid ${P}` : "3px solid transparent",
                    color: isActive ? P : "rgba(255,255,255,.5)",
                    cursor: "pointer", overflow: "hidden" }}>
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div style={{ padding: "10px 10px", borderTop: "0.5px solid rgba(255,255,255,.07)",
          display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%",
            background: P + "33", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: P, flexShrink: 0 }}>
            {(user?.full_name || "AD").slice(0,2).toUpperCase()}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "white",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.full_name || "Admin"}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Super Admin</div>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button onClick={() => logout()}
              style={{ border: "none", background: "transparent", cursor: "pointer",
                color: "rgba(255,255,255,.3)", display: "flex", padding: 4 }}>
              <LogOut size={14} />
            </button>
          )}
        </div>
      </motion.aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <div style={{ background: "white", borderBottom: `0.5px solid ${BORDER}`,
          padding: "0 18px", height: 50, display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setCollapsed(p => !p)}
            style={{ border: "none", background: "transparent", cursor: "pointer",
              color: MUTED, display: "flex", alignItems: "center" }}>
            {collapsed ? <ChevronRight size={19} /> : <X size={19} />}
          </motion.button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => window.location.reload()}
              style={{ display: "flex", alignItems: "center", gap: 6,
                border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "5px 11px",
                background: "white", cursor: "pointer", fontSize: 12, color: MUTED, fontFamily: FONT }}>
              <RefreshCw size={13} />Actualiser
            </button>
            <motion.button whileTap={{ scale: 0.9 }}
              style={{ position: "relative", border: `0.5px solid ${BORDER}`, borderRadius: 8,
                padding: "5px 10px", background: "white", cursor: "pointer",
                display: "flex", alignItems: "center" }}>
              <Bell size={15} color={MUTED} />
              <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7,
                borderRadius: "50%", background: P, border: "1.5px solid white" }} />
            </motion.button>
          </div>
        </div>

        <main style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <AnimatePresence mode="wait">
            <motion.div key={window.location.pathname}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
