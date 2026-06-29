/**
 * MobileBottomNav — Navigation bas de page style OpenTable
 * Visible uniquement sur mobile (< 768px)
 */
import { useNavigate, useLocation } from "react-router-dom";
import { Home, CalendarCheck, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const P    = "#E8A045";
const DARK = "#1E2E28";
const MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

const NAV = [
  { icon: Home,          label: "Accueil",      path: "/"            },
  { icon: CalendarCheck, label: "Réservations", path: "/profil?tab=reservations" },
  { icon: User,          label: "Mon compte",   path: "/profil"      },
];

export default function MobileBottomNav() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/" && !location.search.includes("explore");
    if (path.includes("profil")) return location.pathname.includes("profil");
    return location.pathname === path;
  };

  const handleClick = (item) => {
    if ((item.path.includes("profil") || item.path.includes("reservations")) && !user) {
      navigate("/connexion");
      return;
    }
    navigate(item.path);
  };

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
      background: "white",
      borderTop: "0.5px solid #E4DFD8",
      display: "flex",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      fontFamily: FONT,
      backdropFilter: "blur(10px)",
    }}>
      {NAV.map((item) => {
        const active = isActive(item.path);
        return (
          <button key={item.label} onClick={() => handleClick(item)}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 4, padding: "10px 0 12px",
              background: "none", border: "none", cursor: "pointer",
              color: active ? P : MUTED,
              transition: "color .15s",
            }}>
            <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 400,
              letterSpacing: "0.2px",
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
