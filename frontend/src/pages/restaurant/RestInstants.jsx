import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, EyeOff, ShieldCheck, Clock, ExternalLink } from "lucide-react";
import { Card, PageTitle, Toggle } from "../../components/ui";
import { restaurantsService } from "../../services/restaurants.service.js";
import { storiesService }     from "../../services/stories.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const P      = "#E8A045";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const timeLeft = (expires) => {
  const ms = new Date(expires) - Date.now();
  if (ms <= 0) return "expiré";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h` : `${m} min`;
};

export default function RestInstants() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const pageUrl = `${window.location.origin}/restaurants/${user?.resto_slug || ""}`;

  const loadStories = () => {
    if (!user?.resto_slug) return Promise.resolve();
    return storiesService.list(user.resto_slug)
      .then((d) => setStories(d?.stories || []))
      .catch(() => setStories([]));
  };

  useEffect(() => {
    if (!user?.resto_id) { setLoading(false); return; }
    Promise.all([
      restaurantsService.getManage(user.resto_id),
      loadStories(),
    ])
      .then(([restoData]) => {
        setEnabled(restoData.restaurant?.stories_enabled !== false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.resto_id, user?.resto_slug]);

  const handleToggle = async (val) => {
    setSaving(true);
    setEnabled(val); // optimiste
    try {
      await restaurantsService.update(user.resto_id, { stories_enabled: val });
    } catch (e) {
      console.error(e);
      setEnabled(!val); // rollback
    } finally {
      setSaving(false);
    }
  };

  const hideStory = async (id) => {
    if (!window.confirm("Masquer cet Instant ? Il ne sera plus visible sur votre page. Cette action est définitive.")) return;
    setStories((prev) => prev.filter((s) => s.id !== id)); // optimiste
    try {
      await storiesService.hide(id);
    } catch (e) {
      console.error(e);
      loadStories(); // resync si échec
    }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <PageTitle title="Instants" subtitle="Les photos partagées par vos clients, en direct de leur visite" />
      </motion.div>

      {/* Toggle activation */}
      <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
        <div style={{ background: enabled ? DARK : BG,
          border: `0.5px solid ${enabled ? "transparent" : BORDER}`,
          borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: enabled ? P + "33" : BORDER,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={22} color={enabled ? P : MUTED} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? "white" : DARK, marginBottom: 2 }}>
              Instants {enabled ? "— Activés" : "— Désactivés"}
            </div>
            <div style={{ fontSize: 12, color: enabled ? "rgba(255,255,255,.45)" : MUTED }}>
              {enabled
                ? "Vos clients avec réservation confirmée peuvent partager des photos le jour de leur visite"
                : "Activez pour laisser vos clients partager des photos sur votre page"}
            </div>
          </div>
          <Toggle value={enabled} onChange={handleToggle} disabled={saving} />
        </div>
      </motion.div>

      {/* Rappel des règles */}
      <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {[
            { icon: ShieldCheck, title: "Clients vérifiés", desc: "Seuls les clients avec réservation confirmée, le jour de leur visite, peuvent poster." },
            { icon: Clock,       title: "Éphémère 24h",     desc: "Chaque photo disparaît automatiquement et définitivement après 24 heures." },
            { icon: EyeOff,      title: "Vous gardez la main", desc: "Masquez en un clic toute photo que vous ne souhaitez pas afficher." },
          ].map((c, i) => (
            <div key={i} style={{ background: "white", border: `0.5px solid ${BORDER}`,
              borderRadius: 12, padding: "12px 14px" }}>
              <c.icon size={16} color={P} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: DARK, marginBottom: 2 }}>{c.title}</div>
              <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Galerie des Instants actifs */}
      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>
              Instants en ligne {stories.length > 0 && (
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 400 }}>· {stories.length}</span>
              )}
            </div>
            <button onClick={() => window.open(pageUrl, "_blank")}
              style={{ display: "flex", alignItems: "center", gap: 5, border: `0.5px solid ${BORDER}`,
                borderRadius: 8, padding: "6px 12px", background: "white", color: DARK,
                fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
              <ExternalLink size={13} /> Voir ma page
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "50px 0", color: MUTED, fontSize: 13 }}>Chargement…</div>
          ) : stories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "44px 0", color: MUTED, fontSize: 13 }}>
              <Zap size={28} color={BORDER} style={{ marginBottom: 10 }} />
              <div>Aucun Instant pour le moment.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Ils apparaîtront ici dès que vos clients partageront des photos pendant leur visite.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
              {stories.map((s) => (
                <div key={s.id} style={{ borderRadius: 12, overflow: "hidden",
                  border: `0.5px solid ${BORDER}`, background: "white" }}>
                  <div style={{ position: "relative", width: "100%", aspectRatio: "3/4", background: BG }}>
                    <img src={s.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.55)",
                      color: "white", fontSize: 10, borderRadius: 6, padding: "2px 6px",
                      display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock size={10} /> {timeLeft(s.expires_at)}
                    </div>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: DARK, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(s.author_name || "Client").split(" ")[0]}
                    </div>
                    <div style={{ fontSize: 10.5, color: MUTED, marginBottom: 8 }}>
                      {s.reactions || 0} réaction{(s.reactions || 0) > 1 ? "s" : ""}
                    </div>
                    <button onClick={() => hideStory(s.id)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 5, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 0",
                        background: "white", color: "#DC2626", fontSize: 11.5, fontWeight: 600,
                        cursor: "pointer", fontFamily: FONT }}>
                      <EyeOff size={13} /> Masquer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
