import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Notebook, CalendarCheck, LayoutTemplate, LogOut, Menu, X, Store, ShoppingBag, Zap } from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSSE } from "../../hooks/useSSE.js";
import { useToast } from "../../components/ui/Toast.jsx";

const P      = "#E8A045";
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
  { to: "/restaurant",               label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/restaurant/reservations",  label: "Réservations",    icon: CalendarCheck },
  { to: "/restaurant/plan",          label: "Plan de salle",   icon: LayoutTemplate },
  { to: "/restaurant/menu",          label: "Menu & QR Code",  icon: Notebook },
  { to: "/restaurant/pos",           label: "Service rapide",  icon: Zap, highlight: true },
  { to: "/restaurant/commandes",     label: "Commandes",       icon: ShoppingBag },
  { to: "/restaurant/profil",        label: "Mon restaurant",  icon: Store },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

function SidebarContent({ navigate, user, logout, onClose }) {
  return (
    <>
      {/* Logo */}
      <div style={{ padding: "13px 14px", borderBottom: "0.5px solid rgba(255,255,255,.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => { navigate("/restaurant"); onClose?.(); }}>
          <Logo size={28} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white", lineHeight: 1.2 }}>
              Tablière<span style={{ color: P }}>CI</span>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.3)",
              textTransform: "uppercase", letterSpacing: "1px", marginTop: 2 }}>
              {user?.resto_name || "Mon Restaurant"}
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose}
            style={{ border: "none", background: "transparent",
              cursor: "pointer", color: "rgba(255,255,255,.4)", display: "flex" }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px" }}>
        {NAV.map(({ to, label, icon: Icon, end, highlight }) => (
          <NavLink key={to} to={to} end={end} style={{ textDecoration: "none" }}
            onClick={() => { if (onClose) onClose(); }}>
            {({ isActive }) => (
              <motion.div whileHover={{ background: highlight && !isActive ? "rgba(232,160,69,.2)" : "rgba(232,160,69,.10)" }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                  borderRadius: 9, marginBottom: 1, cursor: "pointer",
                  background: isActive ? "rgba(232,160,69,.15)" : highlight ? "rgba(232,160,69,.08)" : "transparent",
                  borderLeft: isActive ? `3px solid ${P}` : highlight ? `3px solid ${P}55` : "3px solid transparent",
                  color: isActive ? P : highlight ? P + "cc" : "rgba(255,255,255,.5)" }}>
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: isActive || highlight ? 600 : 400 }}>{label}</span>
                {highlight && !isActive && (
                  <span style={{ marginLeft: "auto", fontSize: 8, background: P, color: "#1a1000",
                    borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>LIVE</span>
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: "10px 10px", borderTop: "0.5px solid rgba(255,255,255,.07)",
        display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: P + "33",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: P, flexShrink: 0 }}>
          {(user?.full_name || "RR").slice(0,2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "white",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.full_name || "Gérant"}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Restaurateur</div>
        </div>
        <button onClick={() => logout()}
          style={{ border: "none", background: "transparent",
            cursor: "pointer", color: "rgba(255,255,255,.3)", display: "flex", padding: 4 }}>
          <LogOut size={14} />
        </button>
      </div>
    </>
  );
}

export default function RestaurantLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  useSSE({
    new_reservation: (d) => toast(
      `Nouvelle réservation ${d.ref} — ${d.party_size} pers. · ${d.client_name || ""}`,
      "reservation"
    ),
  }, !!user);

  // Keep-alive ping
  useEffect(() => {
    if (!user) return;
    const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1").replace("/api/v1", "");
    const ping = () => axios.get(`${baseUrl}/ping`, { timeout: 5000 }).catch(() => {});
    ping();
    const id = setInterval(ping, 8 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div style={{ display: "flex", height: "100vh", background: BG,
      overflow: "hidden", fontFamily: FONT }}>

      {/* ── Sidebar desktop ─────────────────────────────────────────────────── */}
      {!isMobile && (
        <aside style={{ width: 210, background: DARK, display: "flex",
          flexDirection: "column", flexShrink: 0 }}>
          <SidebarContent navigate={navigate} user={user} logout={logout} />
        </aside>
      )}

      {/* ── Drawer mobile ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <>
            {/* Backdrop — ferme le drawer au clic */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onPointerDown={() => setMobileOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 200 }} />
            <motion.aside
              initial={{ x: -220 }} animate={{ x: 0 }} exit={{ x: -220 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 210,
                background: DARK, display: "flex", flexDirection: "column",
                zIndex: 201 }}>
              <SidebarContent navigate={navigate} user={user} logout={logout}
                onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar mobile */}
        {isMobile && (
          <div style={{ background: DARK, height: 50, display: "flex", alignItems: "center",
            padding: "0 16px", gap: 12, flexShrink: 0 }}>
            <button onClick={() => setMobileOpen(true)}
              style={{ border: "none", background: "transparent", cursor: "pointer",
                color: "rgba(255,255,255,.7)", display: "flex" }}>
              <Menu size={20} />
            </button>
            <Logo size={22} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
              Tablière<span style={{ color: P }}>CI</span>
            </span>
          </div>
        )}

        <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? 14 : 20 }}>
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname}
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
