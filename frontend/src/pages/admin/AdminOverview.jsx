import { motion } from "framer-motion";
import { Utensils, Users, CalendarCheck, Coins, TrendingUp, TrendingDown,
  CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { StatCard, Card, SectionHeader, Badge, PageTitle } from "../../components/ui";
import { RESERVATIONS, fmt } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const NOTIFS = [
  { type: "success", msg: "Saveurs de Cocody — plan Premium activé",         time: "Il y a 3 min"  },
  { type: "warning", msg: "Maquis Yopougon — 2 no-shows signalés",           time: "Il y a 20 min" },
  { type: "error",   msg: "Erreur paiement Wave — RES-0037 à retraiter",     time: "Il y a 45 min" },
  { type: "info",    msg: "5 nouvelles inscriptions restaurateurs",           time: "Il y a 1h"     },
];

const NOTIF_ICON = { success: CheckCircle, warning: AlertTriangle, error: XCircle, info: Clock };
const NOTIF_COLOR = { success: "#1D9E75", warning: "#854F0B", error: "#993C1D", info: "#185FA5" };
const NOTIF_BG    = { success: "#E1F5EE", warning: "#FAEEDA", error: "#FAECE7", info: "#E6F1FB" };

const STATUS_BADGE = { confirmé: "green", "en attente": "amber", annulé: "red" };

export default function AdminOverview() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Vue d'ensemble" subtitle="Tableau de bord — TablièreCI" />
      </motion.div>

      {/* Metrics */}
      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="Restaurateurs actifs"  value="142"    delta="+8"   up icon={Utensils}     color="#1D9E75" />
        <StatCard label="Utilisateurs inscrits" value="8 430"  delta="+214" up icon={Users}        color="#185FA5" />
        <StatCard label="Réservations (mois)"   value="3 217"  delta="+12%" up icon={CalendarCheck}color="#854F0B" />
        <StatCard label="Revenus FCFA"          value="4.2M"   delta="-3%"     icon={TrendingDown} color="#993C1D" />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, marginBottom: 14 }}>
        {/* Réservations récentes */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Réservations récentes" icon={CalendarCheck}
              action={<span style={{ fontSize: 12, color: "#1D9E75", cursor: "pointer" }}>Tout voir →</span>} />
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                  {["ID","Client","Restaurant","Heure","Statut","Montant"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "5px 7px",
                      color: "#aaa", fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RESERVATIONS.map((r, i) => (
                  <motion.tr key={i} whileHover={{ background: "#fafff9" }}
                    style={{ borderBottom: "0.5px solid #f8f8f8" }}>
                    <td style={{ padding: "8px 7px", fontFamily: "monospace", fontSize: 11, color: "#aaa" }}>{r.id}</td>
                    <td style={{ padding: "8px 7px", fontWeight: 500 }}>{r.client}</td>
                    <td style={{ padding: "8px 7px", color: "#777", fontSize: 12 }}>{r.resto}</td>
                    <td style={{ padding: "8px 7px", color: "#888", fontSize: 12 }}>{r.date.split("·")[1]}</td>
                    <td style={{ padding: "8px 7px" }}><Badge label={r.status} variant={STATUS_BADGE[r.status]} /></td>
                    <td style={{ padding: "8px 7px", fontWeight: 500 }}>{r.montant ? fmt(r.montant) : "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </Card>
        </motion.div>

        {/* Alertes */}
        <motion.div variants={fadeUp}>
          <Card style={{ height: "100%" }}>
            <SectionHeader title="Alertes système" icon={AlertTriangle} />
            {NOTIFS.map((n, i) => {
              const Icon = NOTIF_ICON[n.type];
              return (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0",
                  borderBottom: i < NOTIFS.length - 1 ? "0.5px solid #f8f8f8" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%",
                    background: NOTIF_BG[n.type], display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} color={NOTIF_COLOR[n.type]} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#333", lineHeight: 1.4 }}>{n.msg}</div>
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{n.time}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </motion.div>
      </div>

      {/* Plans */}
      <motion.div variants={fadeUp}>
        <Card>
          <SectionHeader title="Répartition des abonnements" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { name: "Gratuit",  price: "0 F",              count: 38,  pct: 27, color: "#888780", features: ["5 tables","50 résa/mois"] },
              { name: "Standard", price: "25 000 F / mois",  count: 71,  pct: 50, color: "#185FA5", features: ["Tables illimitées","WhatsApp","Analytics"] },
              { name: "Premium",  price: "60 000 F / mois",  count: 33,  pct: 23, color: "#1D9E75", features: ["API","White label","Manager dédié"] },
            ].map((p, i) => (
              <motion.div key={i} whileHover={{ y: -2 }}
                style={{ border: `0.5px solid ${p.color}44`, borderRadius: 10, padding: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: p.color }}>{p.name}</span>
                  <span style={{ fontSize: 20, fontWeight: 600 }}>{p.count}</span>
                </div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>{p.price}</div>
                <div style={{ background: "#f0f0f0", borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 6 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${p.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
                    style={{ height: "100%", background: p.color, borderRadius: 4 }} />
                </div>
                {p.features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 5,
                    fontSize: 11, color: "#666", marginBottom: 2 }}>
                    <CheckCircle size={10} color={p.color} />{f}
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
