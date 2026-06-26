import { motion } from "framer-motion";
import { Activity, Server, Cpu, HardDrive, Wifi, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge } from "../../components/ui";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const SERVICES = [
  { name: "API principale",         status: "opérationnel",  latency: "42ms",  uptime: "99.98%", icon: Server },
  { name: "Base de données",        status: "opérationnel",  latency: "12ms",  uptime: "99.99%", icon: HardDrive },
  { name: "Service WhatsApp",       status: "opérationnel",  latency: "118ms", uptime: "99.82%", icon: Wifi },
  { name: "Passerelle paiement",    status: "dégradé",       latency: "580ms", uptime: "97.20%", icon: Activity },
  { name: "Génération QR Code",     status: "opérationnel",  latency: "65ms",  uptime: "99.95%", icon: CheckCircle },
];

const STATUS_BADGE = { opérationnel: "green", dégradé: "amber", "hors-service": "red" };
const STATUS_COLOR = { opérationnel: "#1D9E75", dégradé: "#854F0B", "hors-service": "#993C1D" };

const LOGS = [
  { level: "INFO",  msg: "Déploiement v2.4.1 réussi",                      time: "17 juin · 09h12" },
  { level: "WARN",  msg: "Latence élevée passerelle paiement (>500ms)",    time: "17 juin · 08h47" },
  { level: "INFO",  msg: "Sauvegarde base de données complète",            time: "17 juin · 04h00" },
  { level: "ERROR", msg: "Timeout Wave API — 3 tentatives échouées",       time: "17 juin · 02h31" },
  { level: "INFO",  msg: "Certificat SSL renouvelé (*.tabliereci.ci)",     time: "16 juin · 23h00" },
];

const LOG_COLOR = { INFO: "#185FA5", WARN: "#854F0B", ERROR: "#993C1D" };
const LOG_BG    = { INFO: "#E6F1FB", WARN: "#FAEEDA", ERROR: "#FAECE7" };

export default function Systeme() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Système" subtitle="État des services et infrastructure" />
      </motion.div>

      {/* Métriques infra */}
      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { label: "CPU",       val: "23%",    bar: 23, color: "#1D9E75", icon: Cpu },
          { label: "Mémoire",   val: "61%",    bar: 61, color: "#185FA5", icon: Server },
          { label: "Disque",    val: "38%",    bar: 38, color: "#854F0B", icon: HardDrive },
          { label: "Réseau",    val: "8 Mbps", bar: 32, color: "#1D9E75", icon: Wifi },
        ].map((m, i) => (
          <div key={i} style={{ background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <m.icon size={15} color={m.color} />
                <span style={{ fontSize: 13, color: "#666" }}>{m.label}</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{m.val}</span>
            </div>
            <div style={{ background: "#f0f0f0", borderRadius: 4, height: 5, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${m.bar}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.08 }}
                style={{ height: "100%", background: m.color, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* État des services */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="État des services" icon={Activity} />
            {SERVICES.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 0", borderBottom: i < SERVICES.length - 1 ? "0.5px solid #f8f8f8" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%",
                    background: STATUS_COLOR[s.status] || "#aaa" }} />
                  <span style={{ fontSize: 13 }}>{s.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{s.latency}</span>
                  <span style={{ fontSize: 11, color: "#bbb" }}>{s.uptime}</span>
                  <Badge label={s.status} variant={STATUS_BADGE[s.status] || "gray"} />
                </div>
              </div>
            ))}
          </Card>
        </motion.div>

        {/* Logs */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Journal système" icon={Server} />
            {LOGS.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0",
                borderBottom: i < LOGS.length - 1 ? "0.5px solid #f8f8f8" : "none",
                alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                  background: LOG_BG[l.level], color: LOG_COLOR[l.level], flexShrink: 0, marginTop: 1 }}>
                  {l.level}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#333" }}>{l.msg}</div>
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{l.time}</div>
                </div>
              </div>
            ))}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
