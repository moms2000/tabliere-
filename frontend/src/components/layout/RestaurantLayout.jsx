import { Outlet, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Notebook, CalendarCheck, LayoutTemplate, BarChart3, Settings } from "lucide-react";

const G = "#1D9E75";

const NAV = [
  { to: "/restaurant",              label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/restaurant/reservations", label: "Réservations",    icon: CalendarCheck },
  { to: "/restaurant/plan",         label: "Plan de salle",   icon: LayoutTemplate },
  { to: "/restaurant/menu",         label: "Menu & QR Code",  icon: Notebook },
];

export default function RestaurantLayout() {
  return (
    <div style={{ display: "flex", height: "100vh", background: "#f7f7f5", overflow: "hidden" }}>
      <aside style={{ width: 200, background: "white", borderRight: "0.5px solid #eee",
        display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 12px", borderBottom: "0.5px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: G,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LayoutTemplate size={15} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: G }}>TablièreCI</div>
              <div style={{ fontSize: 10, color: "#aaa" }}>Le Maquis du Plateau</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "8px 6px" }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={{ textDecoration: "none" }}>
              {({ isActive }) => (
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px",
                  borderRadius: 8, marginBottom: 1, cursor: "pointer",
                  background: isActive ? "#E1F5EE" : "transparent",
                  color: isActive ? G : "#666", fontSize: 13, fontWeight: isActive ? 500 : 400 }}>
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: "10px 8px", borderTop: "0.5px solid #f0f0f0",
          display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E1F5EE",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 600, color: G }}>KJ</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Kouadio Jean</div>
            <div style={{ fontSize: 10, color: "#aaa" }}>Gérant</div>
          </div>
        </div>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <main style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          <AnimatePresence mode="wait">
            <motion.div key={window.location.pathname}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
