import { motion } from "framer-motion";
import { CalendarCheck, Users, Star, TrendingUp, QrCode, Clock, CheckCircle } from "lucide-react";
import { StatCard, Card, SectionHeader, Badge, PageTitle } from "../../components/ui";
import { RESERVATIONS, TABLES, fmt } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE  = { confirmé: "green", "en attente": "amber", annulé: "red" };
const TABLE_COLOR   = { libre: "#1D9E75", occupé: "#993C1D", réservé: "#854F0B" };

const myResas = RESERVATIONS.filter(r => r.resto === "Le Maquis du Plateau");

export default function RestDashboard() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Tableau de bord" subtitle="Le Maquis du Plateau · Aujourd'hui, 17 juin 2026" />
      </motion.div>

      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Réservations ce soir" value={myResas.length}  delta="+2"   up icon={CalendarCheck} color="#1D9E75" />
        <StatCard label="Couverts prévus"       value="14"             delta="+6"   up icon={Users}         color="#185FA5" />
        <StatCard label="Note moyenne"          value="4.8/5"          delta="+0.1" up icon={Star}          color="#854F0B" />
        <StatCard label="Revenus du mois"       value="312K F"         delta="+18%" up icon={TrendingUp}    color="#1D9E75" />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, marginBottom: 14 }}>
        {/* Réservations du jour */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Réservations du soir" icon={CalendarCheck}
              action={<span style={{ fontSize: 12, color: "#1D9E75", cursor: "pointer" }}>Tout voir →</span>} />
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                  {["Client","Heure","Pers.","Table","Statut"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "5px 7px",
                      color: "#aaa", fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myResas.map((r, i) => (
                  <motion.tr key={i} whileHover={{ background: "#fafff9" }}
                    style={{ borderBottom: "0.5px solid #f8f8f8" }}>
                    <td style={{ padding: "8px 7px", fontWeight: 500 }}>{r.client}</td>
                    <td style={{ padding: "8px 7px", color: "#888", fontSize: 12 }}>{r.date.split("·")[1]}</td>
                    <td style={{ padding: "8px 7px" }}>{r.pers}</td>
                    <td style={{ padding: "8px 7px", fontWeight: 500 }}>{r.table}</td>
                    <td style={{ padding: "8px 7px" }}><Badge label={r.status} variant={STATUS_BADGE[r.status]} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </Card>
        </motion.div>

        {/* Plan de tables simplifié */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="État des tables" icon={CheckCircle} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {TABLES.slice(0, 9).map((t, i) => (
                <motion.div key={i} whileHover={{ scale: 1.04 }}
                  style={{ borderRadius: 8, padding: "8px 4px", textAlign: "center",
                    background: TABLE_COLOR[t.status] + "18",
                    border: `0.5px solid ${TABLE_COLOR[t.status]}44` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TABLE_COLOR[t.status] }}>{t.id}</div>
                  <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>{t.cap}p</div>
                  <div style={{ width: 6, height: 6, borderRadius: "50%",
                    background: TABLE_COLOR[t.status], margin: "4px auto 0" }} />
                </motion.div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["libre","#1D9E75"],["occupé","#993C1D"],["réservé","#854F0B"]].map(([s, c]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#888" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />{s}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* QR & info plan */}
      <motion.div variants={fadeUp}>
        <Card style={{ display: "flex", alignItems: "center", gap: 14,
          background: "#E1F5EE", border: "none" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1D9E75",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <QrCode size={22} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F6E56" }}>Menu QR activé</div>
            <div style={{ fontSize: 12, color: "#1D9E75", marginTop: 2 }}>
              tabliereci.ci/menu/le-maquis-du-plateau · 312 scans ce mois
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#0F6E56", cursor: "pointer", fontWeight: 500 }}>
            Voir le QR →
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
