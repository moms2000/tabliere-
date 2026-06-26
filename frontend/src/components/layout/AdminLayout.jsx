import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Utensils, Users, CalendarCheck, CreditCard,
  Activity, Settings, QrCode, Bell, RefreshCw, Menu, X, ChevronRight,
} from "lucide-react";

const NAV = [
  { to: "/admin",              label: "Vue d'ensemble",   icon: LayoutDashboard, end: true },
  { to: "/admin/restaurateurs",label: "Restaurateurs",    icon: Utensils },
  { to: "/admin/utilisateurs", label: "Utilisateurs",     icon: Users },
  { to: "/admin/reservations", label: "Réservations",     icon: CalendarCheck },
  { to: "/admin/finances",     label: "Finances",         icon: CreditCard },
  { to: "/admin/qr-themes",   label: "QR & Thèmes",      icon: QrCode },
  { to: "/admin/systeme",      label: "Système",          icon: Activity },
  { to: "/admin/parametres",   label: "Paramètres",       icon: Settings },
];

const G = "#1D9E75";

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f7f7f5", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 56 : 220 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        style={{ background: "white", borderRight: "0.5px solid #eee",
          display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "14px 12px", borderBottom: "0.5px solid #f0f0f0", minHeight: 52 }}>
          <div onClick={() => navigate("/admin")} style={{ width: 30, height: 30, borderRadius: 8,
            background: G, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, cursor: "pointer" }}>
            <Utensils size={16} color="white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 14, fontWeight: 600, color: G, whiteSpace: "nowrap" }}>
                TablièreCI
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 6px", overflowY: "auto" }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={{ textDecoration: "none" }}>
              {({ isActive }) => (
                <motion.div whileHover={{ background: isActive ? "#E1F5EE" : "#f5f5f5" }}
                  whileTap={{ scale: 0.97 }}
                  style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 9px", borderRadius: 8, marginBottom: 1,
                    background: isActive ? "#E1F5EE" : "transparent",
                    color: isActive ? G : "#666", cursor: "pointer", overflow: "hidden" }}>
                  <Icon size={17} style={{ flexShrink: 0 }} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, whiteSpace: "nowrap" }}>
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: "10px 8px", borderTop: "0.5px solid #f0f0f0",
          display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E1F5EE",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 600, color: G, flexShrink: 0 }}>AD</div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Super Admin</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>admin@tabliereci.ci</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <div style={{ background: "white", borderBottom: "0.5px solid #eee",
          padding: "0 18px", height: 50, display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setCollapsed(p => !p)}
              style={{ border: "none", background: "transparent", cursor: "pointer",
                color: "#666", display: "flex", alignItems: "center" }}>
              {collapsed ? <ChevronRight size={19} /> : <X size={19} />}
            </motion.button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ display: "flex", alignItems: "center", gap: 6, border: "0.5px solid #eee",
              borderRadius: 8, padding: "5px 11px", background: "#fafafa", cursor: "pointer",
              fontSize: 12, color: "#666" }}>
              <RefreshCw size={13} />Actualiser
            </button>
            <motion.button whileTap={{ scale: 0.9 }}
              style={{ position: "relative", border: "0.5px solid #eee", borderRadius: 8,
                padding: "5px 10px", background: "#fafafa", cursor: "pointer",
                display: "flex", alignItems: "center" }}>
              <Bell size={15} color="#666" />
              <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7,
                borderRadius: "50%", background: "#D85A30", border: "1.5px solid white" }} />
            </motion.button>
          </div>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", padding: 18 }}>
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
