import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, TrendingUp, TrendingDown, Banknote, Wallet, Search } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, StatCard, DateFilter } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "0 F";

const STATUS_BADGE = {
  succès: "green", "en attente": "amber", remboursé: "red", échec: "red",
  success: "green", pending: "amber", refunded: "red", failed: "red",
  // valeurs réelles de l'ENUM DB pay_status
  succes: "green", en_attente: "amber", rembourse: "red", echec: "red",
};

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

/* Mapping API → display */
function mapPayment(p) {
  const STATUS_MAP = {
    success: "succès", pending: "en attente", refunded: "remboursé", failed: "échec",
    // valeurs réelles de l'ENUM DB pay_status
    succes: "succès", en_attente: "en attente", rembourse: "remboursé", echec: "échec",
  };
  const isRefund = p.status === "refunded" || p.status === "rembourse";
  return {
    id:      p.resa_ref || `#${p.id}`,
    type:    "Paiement",
    resto:   p.resto_name || "—",
    montant: isRefund ? -Math.abs(Number(p.amount)) : Number(p.amount),
    mode:    p.method || "—",
    date:    p.created_at,
    status:  STATUS_MAP[p.status] || p.status,
    client:  p.client_name || "",
  };
}

export default function Finances() {
  const [dateMode,  setDateMode]  = useState("Mois");
  const [stats,     setStats]     = useState(null);
  const [txns,      setTxns]      = useState([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    adminService.getStats?.().then(s => setStats(s)).catch(() => {});
    adminService.listTransactions()
      .then(data => {
        const rows = data?.data ?? data?.payments ?? data ?? [];
        setTxns(Array.isArray(rows) ? rows.map(mapPayment) : []);
      })
      .catch(() => setTxns([]))
      .finally(() => setLoading(false));
  }, []);

  /* Filtre date */
  const filterByDate = (items) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.date);
      if (dateMode === "Jour")  return d.toDateString() === now.toDateString();
      if (dateMode === "Mois")  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (dateMode === "Année") return d.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const fmtDateRow = (d) => new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"2-digit" });

  const filtered = filterByDate(
    search ? txns.filter(t =>
      (t.id || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.resto || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.type || "").toLowerCase().includes(search.toLowerCase())
    ) : txns
  );

  const totalRevenu    = filtered.filter(t => t.montant > 0).reduce((a, t) => a + t.montant, 0);
  const totalRembours  = filtered.filter(t => t.montant < 0).reduce((a, t) => a + Math.abs(t.montant), 0);
  const totalAbos      = filtered.filter(t => t.type === "Abonnement" && t.montant > 0).reduce((a, t) => a + t.montant, 0);
  const totalCommiss   = filtered.filter(t => t.type === "Réservation" && t.montant > 0).reduce((a, t) => a + t.montant, 0);

  /* Chart mensuel basé sur transactions réelles */
  const currentYear = new Date().getFullYear();
  const chartData = MONTHS.map((m, i) => {
    const value = txns
      .filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === currentYear && d.getMonth() === i && t.montant > 0;
      })
      .reduce((a, t) => a + t.montant, 0);
    return { label: m, value };
  });
  const maxChart = Math.max(...chartData.map(d => d.value), 1);

  /* Répartition par mode de paiement */
  const modeGroups = txns.filter(t => t.montant > 0).reduce((acc, t) => {
    acc[t.mode] = (acc[t.mode] || 0) + t.montant;
    return acc;
  }, {});
  const modeColors = { Wave: "#185FA5", "MTN MoMo": P, "Orange Money": "#EA580C" };
  const modeTotal = Object.values(modeGroups).reduce((a, v) => a + v, 0) || 1;
  const modePcts = Object.entries(modeGroups).map(([name, val]) => ({
    name,
    pct: Math.round((val / modeTotal) * 100),
    color: modeColors[name] || MUTED,
  })).sort((a, b) => b.pct - a.pct).slice(0, 4);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 200, color: MUTED, fontSize: 13, fontFamily: FONT }}>
        Chargement des transactions…
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <PageTitle title="Finances" subtitle="Revenus et transactions de la plateforme" />
          <DateFilter value={dateMode} onChange={setDateMode} />
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Revenus période"     value={fmt(totalRevenu)}    icon={TrendingUp}   color={S} />
        <StatCard label="Abonnements"         value={fmt(totalAbos)}      icon={Wallet}       color={P} />
        <StatCard label="Commissions résa"    value={fmt(totalCommiss)}   icon={Banknote}     color={DARK} />
        <StatCard label="Remboursements"      value={fmt(totalRembours)}  icon={TrendingDown} color="#DC2626" />
      </motion.div>

      {/* Graphique + répartition */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, marginBottom: 14 }}>
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Revenus mensuels (FCFA)" icon={TrendingUp} />
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingTop: 8 }}>
              {chartData.map((m, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4 }}>
                  {m.value > 0 && (
                    <span style={{ fontSize: 9, color: MUTED, fontWeight: 500 }}>
                      {(m.value/1000000).toFixed(1)}M
                    </span>
                  )}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: m.value > 0 ? `${(m.value / maxChart) * 90}px` : "4px" }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.04 }}
                    style={{ width: "100%",
                      background: i === new Date().getMonth() ? P : `${P}33`,
                      borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: MUTED }}>{m.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Par mode de paiement" icon={CreditCard} />
            {(modePcts.length > 0 ? modePcts : [
              { name: "Wave",         pct: 0, color: "#185FA5" },
              { name: "MTN MoMo",     pct: 0, color: P },
              { name: "Orange Money", pct: 0, color: "#EA580C" },
            ]).map((p, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: DARK }}>{p.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: DARK }}>{p.pct}%</span>
                </div>
                <div style={{ background: BG, borderRadius: 4, height: 5, overflow: "hidden" }}>
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
          <div style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <SectionHeader title="Transactions" icon={Banknote} />
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 9, top: "50%",
                transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ID, restaurant, type…"
                style={{ paddingLeft: 28, paddingRight: 10, height: 32,
                  border: `0.5px solid ${BORDER}`, borderRadius: 8, fontSize: 12,
                  outline: "none", color: DARK, width: 200, fontFamily: FONT }} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>
              Aucune transaction pour la période sélectionnée
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                  {["ID","Type","Restaurant","Mode","Montant","Date","Statut"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "5px 8px",
                      color: MUTED, fontWeight: 600, fontSize: 10,
                      textTransform: "uppercase", letterSpacing: "0.8px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <motion.tr key={i} whileHover={{ background: PL }}
                    style={{ borderBottom: `0.5px solid ${BG}` }}>
                    <td style={{ padding: "8px 8px", fontFamily: "monospace", fontSize: 11, color: MUTED }}>{t.id}</td>
                    <td style={{ padding: "8px 8px", fontSize: 12, color: DARK }}>{t.type}</td>
                    <td style={{ padding: "8px 8px", color: MUTED, fontSize: 12 }}>{t.resto}</td>
                    <td style={{ padding: "8px 8px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8,
                        background: BG, color: MUTED }}>{t.mode}</span>
                    </td>
                    <td style={{ padding: "8px 8px", fontWeight: 700,
                      color: t.montant < 0 ? "#DC2626" : DARK }}>
                      {t.montant < 0 ? "-" : ""}{fmt(Math.abs(t.montant))}
                    </td>
                    <td style={{ padding: "8px 8px", fontSize: 11, color: MUTED }}>
                      {fmtDateRow(t.date)}
                    </td>
                    <td style={{ padding: "8px 8px" }}>
                      <Badge label={t.status} variant={STATUS_BADGE[t.status] || "gray"} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
