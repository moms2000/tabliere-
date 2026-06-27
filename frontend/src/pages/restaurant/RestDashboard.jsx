import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Users, Star, TrendingUp, QrCode, CheckCircle } from "lucide-react";
import { StatCard, Card, SectionHeader, Badge, PageTitle } from "../../components/ui";
import { restaurantsService } from "../../services/restaurants.service.js";
import { reservationsService } from "../../services/reservations.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE  = { confirme: "green", en_attente: "amber", annule: "red", confirmé: "green", "en attente": "amber", annulé: "red" };
const TABLE_COLOR   = { libre: "#1D9E75", occupé: "#993C1D", réservé: "#854F0B", reserved: "#854F0B", occupied: "#993C1D", free: "#1D9E75" };

const fmt = (n) => n ? n.toLocaleString("fr-FR") + " F" : "—";

export default function RestDashboard() {
  const { user } = useAuth();
  const [resto,   setResto]   = useState(null);
  const [resas,   setResas]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return; // auth pas encore chargée
    if (!user.resto_id) {
      setLoading(false); // restaurateur sans resto configuré — ne pas rester en spinner
      return;
    }
    Promise.all([
      restaurantsService.getManage(user.resto_id),
      reservationsService.list({ limit: 10 }),
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
    <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 14 }}>
      <div style={{ fontSize: 30, marginBottom: 12 }}>🏪</div>
      <div style={{ fontWeight: 600, color: "#555", marginBottom: 6 }}>Restaurant non configuré</div>
      <div style={{ fontSize: 13 }}>Votre espace est en cours de validation par l'équipe TablièreCI.</div>
    </div>
  );

  const tables     = resto?.tables || [];
  const todayResas = resas.slice(0, 5);
  const libres     = tables.filter(t => t.status === "libre").length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle
          title="Tableau de bord"
          subtitle={`${resto?.name || "Mon restaurant"} · Aujourd'hui, ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
        />
      </motion.div>

      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Réservations aujourd'hui" value={todayResas.length} icon={CalendarCheck} color="#1D9E75" />
        <StatCard label="Tables libres"            value={libres}            icon={Users}         color="#185FA5" />
        <StatCard label="Note moyenne"             value={resto?.rating ? `${resto.rating}/5` : "—"} icon={Star} color="#854F0B" />
        <StatCard label="Total réservations"       value={resas.length}      icon={TrendingUp}    color="#1D9E75" />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, marginBottom: 14 }}>
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Dernières réservations" icon={CalendarCheck} />
            {todayResas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
                Aucune réservation
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                    {["Client","Date","Pers.","Statut"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "5px 7px",
                        color: "#aaa", fontWeight: 500, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayResas.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "0.5px solid #f8f8f8" }}>
                      <td style={{ padding: "8px 7px", fontWeight: 500 }}>{r.client_name || "—"}</td>
                      <td style={{ padding: "8px 7px", color: "#888", fontSize: 12 }}>
                        {r.reserved_at ? new Date(r.reserved_at).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—"}
                      </td>
                      <td style={{ padding: "8px 7px" }}>{r.party_size}</td>
                      <td style={{ padding: "8px 7px" }}><Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="État des tables" icon={CheckCircle} />
            {tables.length === 0 ? (
              <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "20px 0" }}>
                Aucune table configurée
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {tables.slice(0, 9).map((t, i) => {
                  const color = TABLE_COLOR[t.status] || "#aaa";
                  return (
                    <motion.div key={i} whileHover={{ scale: 1.04 }}
                      style={{ borderRadius: 8, padding: "8px 4px", textAlign: "center",
                        background: color + "18", border: `0.5px solid ${color}44` }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>{t.capacity}p</div>
                      <div style={{ width: 6, height: 6, borderRadius: "50%",
                        background: color, margin: "4px auto 0" }} />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {resto?.qr_active && (
        <motion.div variants={fadeUp}>
          <Card style={{ display: "flex", alignItems: "center", gap: 14, background: "#E1F5EE", border: "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1D9E75",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <QrCode size={22} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0F6E56" }}>Menu QR activé</div>
              <div style={{ fontSize: 12, color: "#1D9E75", marginTop: 2 }}>
                /menu/{resto.slug} · accessible par vos clients
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Skeleton de chargement (remplace "Chargement...") ────────────────────────
function Bone({ w = "100%", h = 16, r = 6, mb = 0 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, marginBottom: mb,
      background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.4s infinite" }} />
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <style>{`@keyframes skeleton-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Titre */}
      <div style={{ marginBottom: 20 }}>
        <Bone w="220px" h={22} mb={8} />
        <Bone w="320px" h={13} />
      </div>

      {/* 4 stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: "white", border: "0.5px solid #eee",
            borderRadius: 12, padding: "16px 16px" }}>
            <Bone w="40px" h={40} r={10} mb={12} />
            <Bone w="60%" h={24} mb={6} />
            <Bone w="80%" h={12} />
          </div>
        ))}
      </div>

      {/* Tableau + plan salle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
        <div style={{ background: "white", border: "0.5px solid #eee", borderRadius: 12, padding: 16 }}>
          <Bone w="40%" h={18} mb={16} />
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <Bone w="25%" h={12} />
              <Bone w="30%" h={12} />
              <Bone w="10%" h={12} />
              <Bone w="20%" h={12} />
            </div>
          ))}
        </div>
        <div style={{ background: "white", border: "0.5px solid #eee", borderRadius: 12, padding: 16 }}>
          <Bone w="60%" h={18} mb={16} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[1,2,3,4,5,6].map(i => <Bone key={i} h={60} r={8} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
