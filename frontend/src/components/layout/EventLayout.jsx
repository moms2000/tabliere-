import { Outlet, useNavigate } from "react-router-dom";
import { LogOut, PartyPopper } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const P    = "#E8A045";
const DARK = "#1E2E28";
const BG   = "#F8F5EF";
const FONT = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={P} />
      <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
      <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
      <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

export default function EventLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT }}>
      {/* Topbar */}
      <div style={{ background: DARK, minHeight: 54, display: "flex", alignItems: "center",
        padding: "calc(env(safe-area-inset-top, 0px) + 8px) 18px 8px", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}
          onClick={() => navigate("/event")}>
          <Logo size={26} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white", lineHeight: 1.15 }}>
              Tablière<span style={{ color: P }}>CI</span>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.35)", textTransform: "uppercase",
              letterSpacing: "1px", display: "flex", alignItems: "center", gap: 4 }}>
              <PartyPopper size={9} /> Espace Organisateur
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>
            {(user?.full_name || "").split(" ")[0]}
          </span>
          <button onClick={() => logout()}
            style={{ border: "none", background: "rgba(255,255,255,.1)", borderRadius: 8,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,.7)" }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 16px 60px" }}>
        <Outlet />
      </div>
    </div>
  );
}
