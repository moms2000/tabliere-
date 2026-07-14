import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CalendarCheck, Users, Star, TrendingUp, QrCode, CheckCircle,
  ExternalLink, Calendar, XCircle, Clock, Percent, ShoppingBag, AlertTriangle,
} from "lucide-react";
import { StatCard, Card, SectionHeader, Badge, PageTitle, LoadError } from "../../components/ui";
import { ordersService } from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";
import { reservationsService } from "../../services/reservations.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";

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
  occupe: "#DC2626", occupé: "#DC2626", occupied: "#DC2626",
  reserve: "#C47D1A", réservé: "#C47D1A", reserved: "#C47D1A",
};

const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
  : "—";

export default function RestDashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [resto,    setResto]    = useState(null);
  const [resas,    setResas]    = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [dateMode,      setDateMode]      = useState("Mois");
  const [customDate,    setCustomDate]    = useState("");
  const [showDatePick,  setShowDatePick]  = useState(false);

  const load = () => {
    if (!user) return;
    if (!user.resto_id) { setLoading(false); return; }
    setLoading(true); setError(false);
    Promise.all([
      restaurantsService.getManage(user.resto_id),
      reservationsService.list({ limit: 100 }),
      ordersService.list({ limit: 100 }).catch(() => ({ data: [] })),
    ])
      .then(([restoData, resaData, ordersData]) => {
        setResto(restoData.restaurant);
        setResas(resaData.data || []);
        setOrders(ordersData.data || []);
      })
      .catch(e => { console.error(e); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [user?.resto_id, user]);

  if (loading) return <DashboardSkeleton />;

  if (error) return <LoadError onRetry={load} />;

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
    if (dateMode === "Date" && customDate) return d.toISOString().slice(0,10) === customDate;
    return true; // "Tout"
  });

  const todayResas  = resas.filter(r => r.reserved_at && new Date(r.reserved_at).toDateString() === now.toDateString());
  const confirmed   = filteredResas.filter(r => ["confirme","confirmé"].includes(r.status)).length;
  const pending     = filteredResas.filter(r => ["en_attente","en attente"].includes(r.status)).length;
  const annuled     = filteredResas.filter(r => ["annule","annulé"].includes(r.status)).length;
  const noShows     = filteredResas.filter(r => r.is_noshow || r.status === "no_show").length;
  const libres      = tables.filter(t => ["libre","free"].includes(t.status)).length;
  const occupeesTb  = tables.filter(t => ["occupe","occupé","occupied"].includes(t.status)).length;
  const reserveesTb = tables.filter(t => ["reserve","réservé","reserved"].includes(t.status)).length;
  const avgParty    = filteredResas.length ? (filteredResas.reduce((s, r) => s + (r.party_size || 0), 0) / filteredResas.length).toFixed(1) : 0;
  const tauxConfirm = filteredResas.length ? Math.round(confirmed / filteredResas.length * 100) : 0;
  // Commandes QR du jour
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === now.toDateString());
  const ordersRevenue = todayOrders.filter(o => o.status !== "annule").reduce((s, o) => s + (o.total || 0), 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <PageTitle
            title="Tableau de bord"
            subtitle={`${resto.name} · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
          />
          {/* Filtre date avancé */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            {["Jour","Mois","Année","Tout"].map(m => (
              <button key={m} onClick={() => { setDateMode(m); setShowDatePick(false); }}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                  border: `0.5px solid ${dateMode === m && !showDatePick ? P : BORDER}`,
                  background: dateMode === m && !showDatePick ? PL : "white",
                  color: dateMode === m && !showDatePick ? "#C47D1A" : MUTED,
                  fontWeight: dateMode === m && !showDatePick ? 600 : 400, fontFamily: FONT }}>
                {m}
              </button>
            ))}
            <button onClick={() => { setShowDatePick(p => !p); if (!showDatePick) setDateMode("Date"); }}
              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
                border: `0.5px solid ${showDatePick ? P : BORDER}`,
                background: showDatePick ? PL : "white",
                color: showDatePick ? "#C47D1A" : MUTED,
                fontWeight: showDatePick ? 600 : 400, fontFamily: FONT }}>
              <Calendar size={11} />
              {customDate && dateMode === "Date"
                ? new Date(customDate).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})
                : "Choisir"}
            </button>
            {showDatePick && (
              <input type="date" value={customDate}
                onChange={e => { setCustomDate(e.target.value); setDateMode("Date"); }}
                style={{ fontSize: 12, padding: "3px 8px", borderRadius: 8,
                  border: `0.5px solid ${BORDER}`, fontFamily: FONT,
                  color: DARK, background: "white" }} />
            )}
          </div>
        </div>
      </motion.div>

      {/* KPIs — ligne 1 */}
      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 10 }}>
        <StatCard label="Résa. aujourd'hui" value={todayResas.length}  icon={CalendarCheck} color={S} />
        <StatCard label="Tables libres"     value={`${libres}/${tables.length}`} icon={Users} color="#185FA5" />
        <StatCard label="Confirmées"        value={confirmed}           icon={CheckCircle}   color={S} />
        <StatCard label="En attente"        value={pending}             icon={Clock}         color="#C47D1A" />
      </motion.div>

      {/* KPIs — ligne 2 */}
      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        <StatCard label="Annulées"          value={annuled}             icon={XCircle}       color="#DC2626" />
        <StatCard label="No-shows"          value={noShows}             icon={AlertTriangle} color="#7C3AED" />
        <StatCard label="Taux confirmation" value={`${tauxConfirm}%`}  icon={Percent}       color={S} />
        <StatCard label="Moy. personnes"    value={avgParty}            icon={Users}         color="#0891B2" />
      </motion.div>

      {/* KPIs commandes QR */}
      {orders.length > 0 && (
        <motion.div variants={fadeUp}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
          <StatCard label="Commandes QR auj." value={todayOrders.length}                                          icon={ShoppingBag} color={P} />
          <StatCard label="CA commandes QR"   value={ordersRevenue.toLocaleString("fr-CI") + " F"}               icon={TrendingUp}  color={S} />
          <StatCard label="Commandes en cours" value={orders.filter(o => o.status === "en_cours").length}         icon={Clock}       color="#C47D1A" />
          <StatCard label="Commandes servies"  value={orders.filter(o => o.status === "servi").length}            icon={CheckCircle} color={S} />
        </motion.div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 14, marginBottom: 14 }}>

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
                    <motion.tr key={r.id || r.ref || i} whileHover={{ background: PL }}
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
                        <motion.div key={t.id || i} whileHover={{ scale: 1.04 }}
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
                    <span>{libres} libres</span>
                    <span>·</span>
                    <span>{occupeesTb} occupées</span>
                    <span>·</span>
                    <span>{reserveesTb} réservées</span>
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
                tabliereci.net/menu/{resto.slug}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: "white", border: `0.5px solid ${BORDER}`,
            borderRadius: 12, padding: 16 }}>
            <Bone w="40px" h={40} r={10} mb={12} />
            <Bone w="60%" h={24} mb={6} />
            <Bone w="80%" h={12} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
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
