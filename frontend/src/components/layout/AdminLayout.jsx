import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Utensils, Users, CalendarCheck, CreditCard,
  Activity, Settings, QrCode, Bell, RefreshCw, ChevronRight, X, LogOut, Menu, KeyRound, Globe, BarChart3,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSSE } from "../../hooks/useSSE.js";
import { useToast } from "../../components/ui/Toast.jsx";
import api from "../../services/api.js";
import axios from "axios";

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
  { to: "/admin/analytics",     label: "Base & Analytics", icon: BarChart3 },
  { to: "/admin/restaurateurs", label: "Restaurateurs",   icon: Utensils },
  { to: "/admin/utilisateurs",  label: "Utilisateurs",    icon: Users },
  { to: "/admin/reservations",  label: "Réservations",    icon: CalendarCheck },
  { to: "/admin/qr-themes",     label: "QR & Thèmes",     icon: QrCode },
  { to: "/admin/codes",         label: "Codes accès",     icon: KeyRound },
  { to: "/admin/site",          label: "Site & Contenu",  icon: Globe },
  { to: "/admin/systeme",       label: "Système",         icon: Activity },
  { to: "/admin/parametres",    label: "Paramètres",      icon: Settings },
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

function SidebarContent({ collapsed, navigate, user, logout, onClose }) {
  return (
    <>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10,
        padding: "calc(env(safe-area-inset-top, 0px) + 13px) 14px 13px", borderBottom: "0.5px solid rgba(255,255,255,.07)", minHeight: 54 }}>
        <div onClick={() => { navigate("/admin"); onClose?.(); }} style={{ flexShrink: 0, cursor: "pointer" }}>
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
        {/* X button déplacé hors de la sidebar — voir Drawer mobile */}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} style={{ textDecoration: "none" }}
            onClick={(e) => {
              // Fermer immédiatement sur mobile
              if (onClose) { onClose(); }
            }}>
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
        <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden",
          background: P + "33", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: P, flexShrink: 0 }}>
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (user?.full_name || "AD").slice(0,2).toUpperCase()}
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
    </>
  );
}

export default function AdminLayout() {
  const [collapsed,     setCollapsed]     = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [notifs,        setNotifs]        = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const isMobile  = useIsMobile();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();
  const toast = useToast();

  useSSE({
    new_reservation: (d) => {
      toast(`Nouvelle réservation ${d.ref} — ${d.client_name || ""}`, "reservation");
      setNotifs(p => [{ id: Date.now(), title: `Réservation ${d.ref}`, body: d.client_name || "", is_read: false, created_at: new Date().toISOString() }, ...p.slice(0, 19)]);
    },
  }, !!user);

  const loadNotifs = async () => {
    if (notifs.length > 0) return;
    setNotifsLoading(true);
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data.data?.notifications || data.data || []);
    } catch (_) {}
    setNotifsLoading(false);
  };

  const markAllRead = async () => {
    try { await api.patch("/notifications/read-all"); } catch (_) {}
    setNotifs(p => p.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  // ── Keep-alive : ping toutes les 8 min pour éviter le cold start Render ────
  useEffect(() => {
    if (!user) return;
    const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1")
      .replace("/api/v1", "");
    const ping = () => axios.get(`${baseUrl}/ping`, { timeout: 5000 }).catch(() => {});
    ping(); // ping immédiat au login admin
    const id = setInterval(ping, 8 * 60 * 1000); // toutes les 8 min
    return () => clearInterval(id);
  }, [user]);

  // Fermer le drawer mobile à chaque changement de route
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Fermer le panel notifs au clic extérieur
  useEffect(() => {
    if (!showNotifs) return;
    const close = (e) => {
      if (!e.target.closest("[data-notif-panel]")) setShowNotifs(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showNotifs]);

  return (
    <div style={{ display: "flex", height: "100vh", background: BG,
      overflow: "hidden", fontFamily: FONT }}>

      {/* ── Sidebar desktop ─────────────────────────────────────────────────── */}
      {!isMobile && (
        <motion.aside
          animate={{ width: collapsed ? 58 : 220 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          style={{ background: DARK, display: "flex", flexDirection: "column",
            overflow: "hidden", flexShrink: 0 }}>
          <SidebarContent collapsed={collapsed} navigate={navigate} user={user} logout={logout} />
        </motion.aside>
      )}

      {/* ── Drawer mobile — Portal vers document.body ──────────────────────── */}
      {isMobile && createPortal(
        <>
          <style>{`
            .tci-admin-backdrop {
              position: fixed; inset: 0; background: rgba(0,0,0,.55);
              z-index: 9998;
              opacity: 0; transition: opacity .25s ease;
              pointer-events: none;
            }
            .tci-admin-backdrop.open {
              opacity: 1; pointer-events: auto;
            }
            .tci-admin-sidebar {
              position: fixed; top: 0; left: 0; bottom: 0; width: 220px;
              background: ${DARK}; display: flex; flex-direction: column;
              z-index: 9999; overflow: hidden;
              transform: translateX(-100%); transition: transform .28s cubic-bezier(.4,0,.2,1);
            }
            .tci-admin-sidebar.open {
              transform: translateX(0);
            }
            .tci-admin-close {
              position: fixed; top: calc(env(safe-area-inset-top, 0px) + 11px); left: 172px; z-index: 10000;
              background: rgba(255,255,255,.15); border: none; border-radius: 50%;
              width: 36px; height: 36px; display: flex; align-items: center;
              justify-content: center; cursor: pointer; touch-action: manipulation;
              opacity: 0; pointer-events: none; transition: opacity .2s ease;
            }
            .tci-admin-close.open {
              opacity: 1; pointer-events: auto;
            }
          `}</style>

          {/* Backdrop */}
          <div
            className={`tci-admin-backdrop${mobileOpen ? " open" : ""}`}
            onPointerDown={() => setMobileOpen(false)}
          />

          {/* Sidebar */}
          <aside className={`tci-admin-sidebar${mobileOpen ? " open" : ""}`}>
            <SidebarContent collapsed={false} navigate={navigate} user={user} logout={logout}
              onClose={() => setMobileOpen(false)} />
          </aside>

          {/* Bouton X */}
          <button
            className={`tci-admin-close${mobileOpen ? " open" : ""}`}
            onPointerDown={() => setMobileOpen(false)}
          >
            <X size={20} color="white" />
          </button>
        </>,
        document.body
      )}

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <div style={{ background: "white", borderBottom: `0.5px solid ${BORDER}`,
          padding: "calc(env(safe-area-inset-top, 0px) + 0px) 18px 0", minHeight: 50,
          display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => isMobile ? setMobileOpen(p => !p) : setCollapsed(p => !p)}
            style={{ border: "none", background: "transparent", cursor: "pointer",
              color: MUTED, display: "flex", alignItems: "center" }}>
            {isMobile ? <Menu size={20} /> : collapsed ? <ChevronRight size={19} /> : <X size={19} />}
          </motion.button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isMobile && (
              <button onClick={() => window.location.reload()}
                style={{ display: "flex", alignItems: "center", gap: 6,
                  border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "5px 11px",
                  background: "white", cursor: "pointer", fontSize: 12, color: MUTED, fontFamily: FONT }}>
                <RefreshCw size={13} />Actualiser
              </button>
            )}
            <div style={{ position: "relative" }} data-notif-panel>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => { setShowNotifs(p => !p); if (!showNotifs) loadNotifs(); }}
                style={{ position: "relative", border: `0.5px solid ${BORDER}`, borderRadius: 8,
                  padding: "5px 10px", background: "white", cursor: "pointer",
                  display: "flex", alignItems: "center" }}>
                <Bell size={15} color={MUTED} />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8,
                    borderRadius: "50%", background: P, border: "1.5px solid white" }} />
                )}
              </motion.button>

              <AnimatePresence>
                {showNotifs && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                    style={{ position: "absolute", top: "calc(100% + 8px)", right: 0,
                      width: 320, background: "white", border: `0.5px solid ${BORDER}`,
                      borderRadius: 12, boxShadow: "0 8px 32px rgba(30,46,40,.13)",
                      zIndex: 200, overflow: "hidden" }}>
                    <div style={{ padding: "11px 16px", borderBottom: `0.5px solid ${BORDER}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e2e28" }}>
                        Notifications {unreadCount > 0 && <span style={{ fontSize: 11, color: P }}>({unreadCount})</span>}
                      </span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead}
                          style={{ fontSize: 11, color: P, background: "none", border: "none", cursor: "pointer" }}>
                          Tout lire
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: 340, overflowY: "auto" }}>
                      {notifsLoading ? (
                        <div style={{ padding: 24, textAlign: "center", color: MUTED, fontSize: 13 }}>Chargement…</div>
                      ) : notifs.length === 0 ? (
                        <div style={{ padding: 24, textAlign: "center", color: MUTED, fontSize: 13 }}>Aucune notification</div>
                      ) : notifs.map(n => (
                        <div key={n.id} style={{ padding: "10px 16px", borderBottom: `0.5px solid ${BG}`,
                          background: n.is_read ? "transparent" : "#fef6ec" }}>
                          <div style={{ fontSize: 12, color: "#1e2e28", fontWeight: n.is_read ? 400 : 600 }}>
                            {n.title || n.message}
                          </div>
                          {n.body && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{n.body}</div>}
                          <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
                            {new Date(n.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? 14 : 20 }}>
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname}
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
