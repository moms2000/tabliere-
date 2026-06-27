import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Users, Star, TrendingUp, QrCode, CheckCircle, ExternalLink } from "lucide-react";
import { StatCard, Card, SectionHeader, Badge, PageTitle, DateFilter } from "../../components/ui";
import { restaurantsService } from "../../services/restaurants.service.js";
import { reservationsService } from "../../services/reservations.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE = {
  confirme: "green", en_attente: "amber", annule: "red",
  confirmé: "green", "en attente": "amber", annulé: "red",
  no_show: "red",
};

const TABLE_COLOR = {
  libre: S, free: S,
  occupé: "#DC2626", occupied: "#DC2626",
  réservé: "#C47D1A", reserved: "#C47D1A",
};

const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
  : "—";

export default function RestDashboard() {
  const { user } = useAuth();
  const [resto,    setResto]    = useState(null);
  const [resas,    setResas]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [dateMode, setDateMode] = useState("Mois");

  useEffect(() => {
    if (!user) return;
    if (!user.resto_id) { setLoading(false); return; }
    Promise.all([
      restaurantsService.getManage(user.resto_id),
      reservationsService.list({ limit: 50 }),
    ])
      .then(([restoData, resaData]) => {
        setResto(restoData.restaurant);
        setResas(resaData.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.resto_id, user]);

  if (loading) return <DashboardSkeleton />;

  if (!resto) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: MUTED,
      fontSize: 14, fontFamily: FONT }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: PL,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px" }}>
        <CalendarCheck size={26} color={P} />
      </div>
      <div style={{ fontWeight: 600, color: DARK, marginBottom: 6 }}>Restaurant non configuré</div>
      <div style={{ fontSize: 13 }}>Votre espace est en cours de validation par l'équipe TablièreCI.</div>
    </div>
  );

  const tables = resto?.tables || [];

  /* Filtre par période */
  const now = new Date();
  const filteredResas = resas.filter(r => {
    if (!r.reserved_at) return false;
    const d = new Date(r.reserved_at);
    if (dateMode === "Jour")  return d.toDateString() === now.toDateString();
    if (dateMode === "Mois")  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (dateMode === "Année") return d.getFullYear() === now.getFullYear();
    return true;
  });

  const todayResas  = resas.filter(r => r.reserved_at && new Date(r.reserved_at).toDateString() === now.toDateString());
  const confirmed   = filteredResas.filter(r => ["confirme","confirmé"].includes(r.status)).length;
  const pending     = filteredResas.filter(r => ["en_attente","en attente"].includes(r.status)).length;
  const libres      = tables.filter(t => ["libre","free"].includes(t.status)).length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <PageTitle
            title="Tableau de bord"
            subtitle={`${resto.name} · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
          />
          <DateFilter value={dateMode} onChange={setDateMode} />
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Réservations aujourd'hui" value={todayResas.length}    icon={CalendarCheck} color={S} />
        <StatCard label="Tables libres"            value={libres}               icon={Users}         color="#185FA5" />
        <StatCard label="Confirmées (période)"     value={confirmed}            icon={CheckCircle}   color={S} />
        <StatCard label="En attente"               value={pending}              icon={TrendingUp}    color="#C47D1A" />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, marginBottom: 14 }}>

        {/* Réservations récentes */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Réservations — période" icon={CalendarCheck} />
            {filteredResas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>
                Aucune réservation pour cette période
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                    {["Client","Date & Heure","Pers.","Statut"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "5px 8px",
                        color: MUTED, fontWeight: 700, fontSize: 10,
                        textTransform: "uppercase", letterSpacing: "0.7px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredResas.slice(0, 10).map((r, i) => (
                    <motion.tr key={i} whileHover={{ background: PL }}
                      style={{ borderBottom: `0.5px solid ${BG}` }}>
                      <td style={{ padding: "8px 8px", fontWeight: 600, color: DARK }}>{r.client_name || "—"}</td>
                      <td style={{ padding: "8px 8px", color: MUTED, fontSize: 12 }}>{fmtDate(r.reserved_at)}</td>
                      <td style={{ padding: "8px 8px", color: DARK }}>{r.party_size}</td>
                      <td style={{ padding: "8px 8px" }}><Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </motion.div>

        {/* Plan de salle */}
        <div>
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="État des tables" icon={CheckCircle} />
              {tables.length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED, textAlign: "center", padding: "20px 0" }}>
                  Aucune table configurée
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {tables.slice(0, 9).map((t, i) => {
                      const color = TABLE_COLOR[t.status] || MUTED;
                      return (
                        <motion.div key={i} whileHover={{ scale: 1.04 }}
                          style={{ borderRadius: 8, padding: "8px 4px", textAlign: "center",
                            background: color + "18", border: `0.5px solid ${color}44` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color }}>{t.label}</div>
                          <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{t.capacity}p</div>
                          <div style={{ width: 6, height: 6, borderRadius: "50%",
                            background: color, margin: "4px auto 0" }} />
                        </motion.div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12, fontSize: 11, color: MUTED }}>
                    <span>{tables.filter(t => ["libre","free"].includes(t.status)).length} libres</span>
                    <span>·</span>
                    <span>{tables.filter(t => ["occupé","occupied"].includes(t.status)).length} occupées</span>
                    <span>·</span>
                    <span>{tables.filter(t => ["réservé","reserved"].includes(t.status)).length} réservées</span>
                  </div>
                </>
              )}
            </Card>
          </motion.div>

          {/* Note moyenne */}
          {resto.rating && (
            <motion.div variants={fadeUp} style={{ marginTop: 14 }}>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: PL,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Star size={18} color={P} />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>{Number(resto.rating).toFixed(1)}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{resto.review_count || 0} avis</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bannière QR actif */}
      {resto?.qr_active && (
        <motion.div variants={fadeUp}>
          <Card style={{ display: "flex", alignItems: "center", gap: 14,
            background: PL, border: `0.5px solid ${P}44` }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: P,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <QrCode size={20} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Menu QR activé</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                tabliereci.com/menu/{resto.slug}
              </div>
            </div>
            <a href={`/menu/${resto.slug}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                color: P, textDecoration: "none", fontWeight: 600 }}>
              Voir <ExternalLink size={12} />
            </a>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────────── */
function Bone({ w = "100%", h = 16, r = 6, mb = 0 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, marginBottom: mb,
      background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "skeleton-shimmer 1.4s infinite" }} />
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ fontFamily: FONT }}>
      <style>{`@keyframes skeleton-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ marginBottom: 20 }}>
        <Bone w="220px" h={22} mb={8} />
        <Bone w="320px" h={13} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: "white", border: `0.5px solid ${BORDER}`,
            borderRadius: 12, padding: 16 }}>
            <Bone w="40px" h={40} r={10} mb={12} />
            <Bone w="60%" h={24} mb={6} />
            <Bone w="80%" h={12} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
        <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <Bone w="40%" h={18} mb={16} />
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <Bone w="25%" h={12} /><Bone w="30%" h={12} /><Bone w="10%" h={12} /><Bone w="20%" h={12} />
            </div>
          ))}
        </div>
        <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <Bone w="60%" h={18} mb={16} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[1,2,3,4,5,6].map(i => <Bone key={i} h={60} r={8} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
