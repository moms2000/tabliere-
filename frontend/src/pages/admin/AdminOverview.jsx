import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Utensils, Users, CalendarCheck, CreditCard, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { StatCard, Card, SectionHeader, Badge, PageTitle } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "0 F";

const STATUS_BADGE = {
  en_attente: "amber", confirme: "green", annule: "red",
  "en attente": "amber", confirmé: "green", annulé: "red",
};

export default function AdminOverview() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 13 }}>Chargement…</div>
  );

  const g = stats?.global || {};
  const recent = stats?.recentActivity || [];
  const byPlan = stats?.byPlan || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Vue d'ensemble" subtitle="Tableau de bord — TablièreCI" />
      </motion.div>

      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Restaurants actifs"    value={g.total_restos   || 0} icon={Utensils}     color="#1D9E75" />
        <StatCard label="Utilisateurs inscrits" value={g.total_clients  || 0} icon={Users}        color="#185FA5" />
        <StatCard label="Réservations (auj.)"   value={g.resa_today     || 0} icon={CalendarCheck} color="#854F0B" />
        <StatCard label="Revenus du jour"       value={fmt(g.revenue_today)} icon={CreditCard}   color="#993C1D" />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Activité récente" icon={CalendarCheck} />
            {recent.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
                Aucune activité récente
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                    {["Référence","Client","Restaurant","Date","Statut"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "5px 7px",
                        color: "#aaa", fontWeight: 500, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "0.5px solid #f8f8f8" }}>
                      <td style={{ padding: "8px 7px", fontFamily: "monospace", fontSize: 11, color: "#aaa" }}>{r.ref}</td>
                      <td style={{ padding: "8px 7px", fontWeight: 500 }}>{r.client_name || "—"}</td>
                      <td style={{ padding: "8px 7px", fontSize: 12, color: "#666" }}>{r.resto_name || "—"}</td>
                      <td style={{ padding: "8px 7px", fontSize: 12, color: "#888" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td style={{ padding: "8px 7px" }}>
                        <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Plans d'abonnement" />
            {byPlan.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "9px 0", borderBottom: "0.5px solid #f8f8f8" }}>
                <span style={{ fontSize: 13, textTransform: "capitalize" }}>{p.plan}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: "#1D9E75" }}>{p.count}</span>
              </div>
            ))}
            {byPlan.length === 0 && (
              <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "20px 0" }}>
                Aucune donnée
              </div>
            )}
          </Card>

          <div style={{ marginTop: 14 }}>
            <Card>
              <SectionHeader title="Revenus du mois" />
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1D9E75" }}>
                {fmt(g.revenue_month)}
              </div>
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Ce mois-ci</div>
            </Card>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
