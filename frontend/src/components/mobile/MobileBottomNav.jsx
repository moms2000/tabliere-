/**
 * MobileBottomNav — Navigation bas de page style OpenTable
 * 5 onglets : Accueil · Recherche · Récompenses · Réservations · Profil
 * Visible uniquement sur mobile (< 768px)
 */
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Award, CalendarCheck, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const P     = "#E8A045";
const MUTED = "#9BA89F";
const FONT  = "'Avenir Next','Avenir','Century Gothic',sans-serif";

const NAV = [
  { icon: Home,          label: "Accueil",      path: "/",                        auth: false },
  { icon: Search,        label: "Recherche",    path: "/?focus=search",           auth: false },
  { icon: Award,         label: "Récompenses",  path: "/profil?tab=rewards",       auth: true  },
  { icon: CalendarCheck, label: "Réservations", path: "/profil?tab=reservations",  auth: true  },
  { icon: User,          label: "Profil",       path: "/profil",                   auth: true  },
];

export default function MobileBottomNav() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const params   = new URLSearchParams(location.search);
  const tab      = params.get("tab");
  const onProfil = location.pathname.startsWith("/profil");

  const isActive = (item) => {
    if (item.path === "/") return location.pathname === "/" && !location.search.includes("focus=search");
    if (item.path.includes("focus=search"))     return location.pathname === "/" && location.search.includes("focus=search");
    if (item.path.includes("tab=rewards"))       return onProfil && tab === "rewards";
    if (item.path.includes("tab=reservations"))  return onProfil && tab === "reservations";
    if (item.path === "/profil")                 return onProfil && (!tab || tab === "profile");
    return false;
  };

  const handleClick = (item) => {
    if (item.auth && !user) { navigate("/connexion"); return; }
    navigate(item.path);
  };

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
      // Fond OPAQUE (pas de backdrop-filter) : sur iOS/WKWebView, un élément
      // position:fixed avec backdrop-filter se décale pendant le scroll inertiel.
      background: "#FFFFFF",
      borderTop: "0.5px solid #E4DFD8",
      display: "flex",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      fontFamily: FONT,
      transform: "translateZ(0)",        // force une couche de composition dédiée
      WebkitTransform: "translateZ(0)",
      boxShadow: "0 -1px 10px rgba(30,46,40,.05)",
    }}>
      {NAV.map((item) => {
        const active = isActive(item);
        return (
          <button key={item.label} onClick={() => handleClick(item)}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 3, padding: "9px 0 10px",
              background: "none", border: "none", cursor: "pointer",
              color: active ? P : MUTED,
              transition: "color .15s",
            }}>
            <item.icon size={21} strokeWidth={active ? 2.5 : 1.8} />
            <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500, letterSpacing: "0.1px" }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
