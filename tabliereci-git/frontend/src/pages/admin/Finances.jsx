import { motion } from "framer-motion";
import { CreditCard, TrendingUp, TrendingDown, Banknote, Wallet } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, StatCard } from "../../components/ui";
import { fmt } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const TRANSACTIONS = [
  { id: "TXN-1028", type: "Abonnement",  plan: "Premium",  resto: "Saveurs de Cocody",       montant: 60000, mode: "Wave",          date: "17 juin 2026", status: "succès" },
  { id: "TXN-1027", type: "Réservation", plan: "—",        resto: "Le Maquis du Plateau",    montant: 12000, mode: "MTN MoMo",      date: "17 juin 2026", status: "succès" },
  { id: "TXN-1026", type: "Abonnement",  plan: "Standard", resto: "La Terrasse d'Abidjan",   montant: 25000, mode: "Orange Money",  date: "16 juin 2026", status: "succès" },
  { id: "TXN-1025", type: "Réservation", plan: "—",        resto: "Saveurs de Cocody",       montant: 24000, mode: "Orange Money",  date: "16 juin 2026", status: "en attente" },
  { id: "TXN-1024", type: "Remboursem.", plan: "—",        resto: "Le Maquis du Plateau",    montant: -8500, mode: "Wave",          date: "15 juin 2026", status: "remboursé" },
];

const STATUS_BADGE = { succès: "green", "en attente": "amber", remboursé: "red", échec: "red" };

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun"];
const VALUES  = [1.2, 1.8, 2.1, 2.8, 3.5, 4.2];
const MAX     = Math.max(...VALUES);

export default function Finances() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Finances" subtitle="Revenus et transactions de la plateforme" />
      </motion.div>

      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Revenus totaux (mois)"  value="4.2M F"  delta="+12%" up icon={TrendingUp}   color="#1D9E75" />
        <StatCard label="Abonnements"             value="2.1M F"  delta="+8%"  up icon={Wallet}       color="#185FA5" />
        <StatCard label="Commissions résa"        value="1.8M F"  delta="+15%" up icon={Banknote}     color="#854F0B" />
        <StatCard label="Remboursements"          value="85K F"   delta="-3%"     icon={TrendingDown} color="#993C1D" />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, marginBottom: 14 }}>
        {/* Graphique mensuel */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Revenus mensuels (FCFA M)" icon={TrendingUp} />
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120, paddingTop: 8 }}>
              {MONTHS.map((m, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, color: "#888", fontWeight: 500 }}>{VALUES[i]}M</span>
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: (VALUES[i] / MAX) * 90 }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.07 }}
                    style={{ width: "100%", background: i === MONTHS.length - 1 ? "#1D9E75" : "#E1F5EE",
                      borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 10, color: "#aaa" }}>{m}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Répartition par mode */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Par mode de paiement" icon={CreditCard} />
            {[
              { name: "Wave",         pct: 38, color: "#185FA5" },
              { name: "MTN MoMo",     pct: 29, color: "#854F0B" },
              { name: "Orange Money", pct: 25, color: "#993C1D" },
              { name: "Carte",        pct: 8,  color: "#888780" },
            ].map((p, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12 }}>{p.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{p.pct}%</span>
                </div>
                <div style={{ background: "#f0f0f0", borderRadius: 4, height: 5, overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${p.pct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.08 }}
                    style={{ height: "100%", background: p.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </Card>
        </motion.div>
      </div>

      {/* Transactions */}
      <motion.div variants={fadeUp}>
        <Card>
          <SectionHeader title="Dernières transactions" icon={Banknote} />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                {["ID","Type","Restaurant","Mode","Montant","Date","Statut"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "5px 8px",
                    color: "#aaa", fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRANSACTIONS.map((t, i) => (
                <motion.tr key={i} whileHover={{ background: "#fafff9" }}
                  style={{ borderBottom: "0.5px solid #f8f8f8" }}>
                  <td style={{ padding: "8px 8px", fontFamily: "monospace", fontSize: 11, color: "#aaa" }}>{t.id}</td>
                  <td style={{ padding: "8px 8px", fontSize: 12 }}>{t.type}</td>
                  <td style={{ padding: "8px 8px", color: "#666", fontSize: 12 }}>{t.resto}</td>
                  <td style={{ padding: "8px 8px" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8,
                      background: "#f5f5f5", color: "#555" }}>{t.mode}</span>
                  </td>
                  <td style={{ padding: "8px 8px", fontWeight: 600,
                    color: t.montant < 0 ? "#993C1D" : "#1a1a1a" }}>
                    {t.montant < 0 ? "-" : ""}{fmt(Math.abs(t.montant))}
                  </td>
                  <td style={{ padding: "8px 8px", fontSize: 11, color: "#999" }}>{t.date}</td>
                  <td style={{ padding: "8px 8px" }}><Badge label={t.status} variant={STATUS_BADGE[t.status]} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Card>
      </motion.div>
    </motion.div>
  );
}
