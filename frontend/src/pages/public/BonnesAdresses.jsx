import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, UtensilsCrossed, Search } from "lucide-react";
import { restaurantsService } from "../../services/restaurants.service.js";
import { usePageMeta } from "../../hooks/usePageMeta.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", WHITE = "#FFFFFF";
const BORDER = "#E4DFD8", MUTED = "#9BA89F";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

export default function BonnesAdresses() {
  const navigate = useNavigate();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  usePageMeta("Bonnes adresses", "Food trucks, kiosques et maquis d'Abidjan · sans réservation · TablièreCI");

  useEffect(() => {
    restaurantsService.list({ mode: "vitrine", limit: 50, sort: "recent" })
      .then(res => setItems(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 80px)" }}>
      {/* En-tête */}
      <div style={{ padding: "calc(env(safe-area-inset-top,0px) + 22px) 20px 12px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: DARK, margin: 0, letterSpacing: "-0.4px" }}>Bonnes adresses</h1>
        <p style={{ fontSize: 13.5, color: MUTED, margin: "5px 0 0", lineHeight: 1.5 }}>
          Food trucks, kiosques et maquis, sans réservation. Découvrez le menu, appelez ou trouvez l'itinéraire.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px 0", color: MUTED, fontSize: 14 }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: MUTED }}>
          <MapPin size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 15, color: DARK, fontWeight: 600 }}>Aucune adresse pour l'instant</div>
          <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>De nouveaux lieux arrivent bientôt.</div>
          <button onClick={() => navigate("/")}
            style={{ marginTop: 20, background: P, color: "#1A1000", border: "none", borderRadius: 10,
              padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
              display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Search size={15} /> Voir les restaurants
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
          gap: 14, padding: "6px 16px 8px", maxWidth: 900, margin: "0 auto" }}>
          {items.map((r, i) => {
            const photos = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos : null;
            const imgSrc = photos ? photos[0] : r.logo_url;
            return (
              <motion.div key={r.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => navigate(`/restaurants/${r.slug}`)}
                style={{ background: WHITE, borderRadius: 16, border: `0.5px solid ${BORDER}`, overflow: "hidden",
                  cursor: "pointer", boxShadow: "0 2px 14px rgba(30,46,40,.05)" }}>
                <div style={{ position: "relative", height: 150, background: BG, display: "flex",
                  alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {imgSrc
                    ? <img src={imgSrc} alt={r.name} loading="lazy"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        onError={e => { e.target.style.display = "none"; }} />
                    : <UtensilsCrossed size={38} color={P} style={{ opacity: 0.35 }} />}
                  <span style={{ position: "absolute", top: 10, left: 10, fontSize: 10, fontWeight: 700,
                    color: "#1A1000", background: "rgba(255,255,255,.92)", padding: "3px 10px", borderRadius: 20 }}>
                    Bonne adresse
                  </span>
                </div>
                <div style={{ padding: "12px 14px 14px" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: DARK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5, color: MUTED, fontSize: 12.5, flexWrap: "wrap" }}>
                    {r.quartier && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MapPin size={12} />{r.quartier}{r.ville ? `, ${r.ville}` : ""}</span>}
                    {r.cuisine_type && <><span style={{ color: BORDER }}>·</span><span>{r.cuisine_type}</span></>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
