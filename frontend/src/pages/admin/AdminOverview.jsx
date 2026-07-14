import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Utensils, Users, CalendarCheck, TrendingUp, Star, Activity } from "lucide-react";
import { StatCard, Card, SectionHeader, Badge, PageTitle, LoadError } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

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
  en_attente: "amber", confirme: "green", annule: "red",
  "en attente": "amber", confirmé: "green", annulé: "red",
};

const PLAN_COLORS = {
  starter: MUTED, essentiel: "#185FA5",
  pro: S, premium: P, enterprise: DARK,
};

export default function AdminOverview() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    adminService.getStats()
      .then(setStats)
      .catch(e => { console.error(e); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: MUTED,
      fontSize: 13, fontFamily: FONT }}>Chargement…</div>
  );
  if (error) return <LoadError onRetry={load} />;

  const g      = stats?.global || {};
  const recent = stats?.recentActivity || [];
  const byPlan = stats?.byPlan || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <PageTitle title="Vue d'ensemble"
          subtitle={`Tableau de bord · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`} />
      </motion.div>

      {/* KPIs */}
      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Restaurants actifs"    value={g.total_restos  || 0} icon={Utensils}     color={S} />
        <StatCard label="Clients inscrits"      value={g.total_clients || 0} icon={Users}        color="#185FA5" />
        <StatCard label="Réservations (auj.)"   value={g.resa_today    || 0} icon={CalendarCheck} color={P} />
        <StatCard label="Réservations (mois)"   value={g.resa_month    || 0} icon={TrendingUp}   color={DARK} />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>

        {/* Activité récente */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Activité récente" icon={Activity} />
            {recent.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>
                Aucune activité récente
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                    {["Référence","Client","Restaurant","Date","Statut"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "5px 8px",
                        color: MUTED, fontWeight: 700, fontSize: 10,
                        textTransform: "uppercase", letterSpacing: "0.7px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <motion.tr key={i} whileHover={{ background: PL }}
                      style={{ borderBottom: `0.5px solid ${BG}` }}>
                      <td style={{ padding: "8px 8px", fontFamily: "monospace", fontSize: 11, color: MUTED }}>{r.ref}</td>
                      <td style={{ padding: "8px 8px", fontWeight: 600, color: DARK }}>{r.client_name || "—"}</td>
                      <td style={{ padding: "8px 8px", fontSize: 12, color: MUTED }}>{r.resto_name || "—"}</td>
                      <td style={{ padding: "8px 8px", fontSize: 12, color: MUTED }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td style={{ padding: "8px 8px" }}>
                        <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </motion.div>

        {/* Sidebar stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Plans */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Plans d'abonnement" icon={Star} />
              {byPlan.length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED, textAlign: "center", padding: "16px 0" }}>
                  Aucune donnée
                </div>
              ) : (
                byPlan.map((p, i) => {
                  const color = PLAN_COLORS[p.plan] || MUTED;
                  const maxCount = Math.max(...byPlan.map(x => +x.count), 1);
                  return (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: DARK, fontWeight: 500, textTransform: "capitalize" }}>
                          {p.plan}
                        </span>
                        <span style={{ fontWeight: 700, color }}>{p.count}</span>
                      </div>
                      <div style={{ background: BG, borderRadius: 4, height: 5, overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }}
                          animate={{ width: `${(+p.count / maxCount) * 100}%` }}
                          transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.08 }}
                          style={{ height: "100%", background: color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </motion.div>

          {/* Totaux */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Statistiques globales" icon={TrendingUp} />
              {[
                { label: "Total restaurants",     val: g.total_restos  || 0 },
                { label: "Total utilisateurs",    val: g.total_clients || 0 },
                { label: "Réservations auj.",     val: g.resa_today    || 0 },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: i < 2 ? `0.5px solid ${BG}` : "none",
                  fontSize: 13 }}>
                  <span style={{ color: MUTED }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: DARK }}>{s.val}</span>
                </div>
              ))}
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
