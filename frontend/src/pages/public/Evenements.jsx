import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, ArrowLeft, PartyPopper } from "lucide-react";
import { eventsService } from "../../services/events.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function Evenements() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsService.listPublic({ limit: 50 })
      .then(r => setEvents(r?.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT }}>
      <div style={{ background: DARK, padding: "calc(env(safe-area-inset-top,0px) + 16px) 18px 20px" }}>
        <button onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent",
            color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 13, marginBottom: 12, padding: 0, fontFamily: FONT }}>
          <ArrowLeft size={15} /> Accueil
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <PartyPopper size={22} color={P} /> Événements
        </h1>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Soirées & événements à venir en Côte d'Ivoire</div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 16px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>Chargement…</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "70px 20px", color: MUTED }}>
            <PartyPopper size={36} color={BORDER} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>Aucun événement à venir pour le moment.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {events.map(e => (
              <motion.div key={e.id} whileHover={{ y: -2 }} onClick={() => navigate(`/evenement/${e.slug}`)}
                style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ height: 120, background: e.cover_url ? `url(${e.cover_url}) center/cover` : `linear-gradient(135deg, ${DARK}, #2c4438)` }} />
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 8,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, marginBottom: 3 }}>
                    <Calendar size={12} /> {fmtDate(e.starts_at)}
                  </div>
                  {(e.venue_name || e.ville) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}>
                      <MapPin size={12} /> {[e.venue_name, e.ville].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
