import { useState, useEffect } from "react";
import { Wrench } from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

/**
 * Bloque le site public quand le mode maintenance est activé (admins exemptés).
 * Vérifie /status en arrière-plan ET réagit aux 503 MAINTENANCE renvoyés par l'API.
 */
export default function MaintenanceGate({ children }) {
  const { user } = useAuth();
  const [maint, setMaint] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => api.get("/status").then(r => { if (alive) setMaint(!!r.data?.maintenance); }).catch(() => {});
    check();
    // L'intercepteur API émet cet événement dès qu'une réponse 503 MAINTENANCE arrive
    const onMaint = () => alive && setMaint(true);
    window.addEventListener("tci:maintenance", onMaint);
    return () => { alive = false; window.removeEventListener("tci:maintenance", onMaint); };
  }, []);

  if (maint && user?.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 28 }}>
          Tablière<span style={{ color: P }}>CI</span>
        </div>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#FEF6EC",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
          <Wrench size={32} color={P} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: DARK, margin: "0 0 10px" }}>Site en maintenance</h1>
        <p style={{ fontSize: 14.5, color: MUTED, maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
          Nous effectuons une mise à jour pour améliorer votre expérience. Le site sera de nouveau accessible dans quelques instants. Merci de votre patience.
        </p>
      </div>
    );
  }
  return children;
}
