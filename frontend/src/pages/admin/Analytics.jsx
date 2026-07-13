import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, UtensilsCrossed, Store, CalendarDays, FileText, Sheet, TrendingUp } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";
import Classements from "../../components/admin/Classements.jsx";
import PlatformStats from "../../components/admin/PlatformStats.jsx";

const P = "#E8A045", DARK = "#1E2E28", GREEN = "#1D9E75", MUTED = "#9BA89F", BORDER = "#eee", BG = "#F8F5EF";
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };
const fmtInt  = (n) => Number(n || 0).toLocaleString("fr-FR");
const fmtF    = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";
const STATUS_FR = { en_attente: "En attente", confirme: "Confirmées", annule: "Annulées", no_show: "No-show", termine: "Terminées" };

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    adminService.getAnalytics().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const doExport = async (kind) => {
    if (!data) return;
    setBusy(kind);
    try {
      const mod = await import("../../services/exports.js");
      const fn = kind === "pdf" ? mod.exportPDF : mod.exportXLSX;
      // On exporte les 3 tables sur des feuilles/sections
      const dishes = (data.top_dishes || []).map(d => [d.name, fmtInt(d.qty), fmtF(d.revenue)]);
      const cuisines = (data.top_cuisines || []).map(c => [c.cuisine, fmtInt(c.reservations)]);
      const restos = (data.reservations?.top_restaurants || []).map(r => [r.name, fmtInt(r.reservations)]);
      if (kind === "pdf") {
        await mod.exportPDF({
          title: "Analytics — Plats les plus commandés (QR)", subtitle: "Espace administrateur",
          columns: ["Plat", "Quantité", "Revenu"], rows: dishes, filename: "tabliereci-analytics-plats",
          summary: [{ label: "Réservations", value: fmtInt(data.reservations?.total) }, { label: "Couverts", value: fmtInt(data.reservations?.total_covers) }],
        });
      } else {
        // Excel : une feuille par jeu de données via 3 exports séparés serait lourd → on met tout à plat
        await mod.exportXLSX({
          sheetName: "Plats QR", title: "Analytics — Plats les plus commandés (QR)", subtitle: "Espace administrateur",
          columns: ["Plat", "Quantité", "Revenu"], rows: dishes, filename: "tabliereci-analytics-plats",
        });
      }
    } catch (e) { alert("Export impossible"); console.error(e); }
    finally { setBusy(null); }
  };

  if (loading) return <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>Chargement…</div>;
  if (!data) return <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>Aucune donnée.</div>;

  const r = data.reservations || {};
  const maxMonth = Math.max(1, ...(r.by_month || []).map(m => m.count));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <PageTitle title="Base de données & Analytics" subtitle="Réservations, plats les plus commandés et types de restaurants" />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn icon={FileText} onClick={() => doExport("pdf")} disabled={busy}>{busy === "pdf" ? "…" : "PDF"}</Btn>
          <Btn icon={Sheet} onClick={() => doExport("xls")} disabled={busy}>{busy === "xls" ? "…" : "Excel"}</Btn>
        </div>
      </motion.div>

      {/* Stats réservations */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Réservations (total)", val: fmtInt(r.total), color: DARK },
          { label: "Ce mois-ci", val: fmtInt(r.this_month), color: GREEN },
          { label: "Couverts cumulés", val: fmtInt(r.total_covers), color: P },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 150, background: "white", border: `0.5px solid ${BORDER}`,
            borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, color: MUTED }}>{s.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      {/* Statistiques plateforme (croissance, géo, adoption) */}
      <motion.div variants={fadeUp} style={{ marginBottom: 12 }}>
        <PlatformStats />
      </motion.div>

      {/* Classements (période + métriques + à relancer) */}
      <motion.div variants={fadeUp} style={{ marginBottom: 12 }}>
        <Classements />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {/* Réservations par mois */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Réservations — 12 derniers mois" icon={CalendarDays} />
            {(r.by_month || []).length === 0 ? <Empty /> : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, marginTop: 8 }}>
                {r.by_month.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, color: MUTED }}>{m.count}</div>
                    <div style={{ width: "100%", background: P, borderRadius: "4px 4px 0 0",
                      height: `${Math.round((m.count / maxMonth) * 92)}px`, minHeight: 2 }} />
                    <div style={{ fontSize: 8.5, color: MUTED }}>{m.month.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Par statut */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Réservations par statut" icon={TrendingUp} />
            {(r.by_status || []).length === 0 ? <Empty /> : (
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {r.by_status.map((s, i) => (
                  <Row key={i} label={STATUS_FR[s.status] || s.status} value={fmtInt(s.count)} />
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Top restaurants */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Restaurants les plus réservés" icon={Store} />
            {(r.top_restaurants || []).length === 0 ? <Empty /> : (
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {r.top_restaurants.map((t, i) => (
                  <Row key={i} rank={i + 1} label={t.name} value={fmtInt(t.reservations)} />
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Types de resto */}
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Types de restaurant les plus réservés" icon={UtensilsCrossed} />
            {(data.top_cuisines || []).length === 0 ? <Empty /> : (
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {data.top_cuisines.map((c, i) => (
                  <Row key={i} rank={i + 1} label={c.cuisine} value={fmtInt(c.reservations)} />
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Plats les plus commandés QR */}
      <motion.div variants={fadeUp} style={{ marginTop: 12 }}>
        <Card>
          <SectionHeader title="Plats les plus commandés (via QR)" icon={BarChart3} />
          {(data.top_dishes || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>
              Aucune commande QR enregistrée pour le moment.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ textAlign: "left", color: MUTED, fontSize: 11, textTransform: "uppercase" }}>
                  <th style={th}>#</th><th style={th}>Plat</th>
                  <th style={{ ...th, textAlign: "right" }}>Quantité</th>
                  <th style={{ ...th, textAlign: "right" }}>Revenu</th>
                </tr></thead>
                <tbody>
                  {data.top_dishes.map((d, i) => (
                    <tr key={i} style={{ borderTop: `0.5px solid ${BG}` }}>
                      <td style={{ ...td, color: MUTED }}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600, color: DARK }}>{d.name}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(d.qty)}</td>
                      <td style={{ ...td, textAlign: "right", color: GREEN, fontWeight: 600 }}>{fmtF(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value, rank }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#fafafa", borderRadius: 8 }}>
      {rank && <span style={{ fontSize: 11, color: MUTED, width: 16 }}>{rank}</span>}
      <span style={{ flex: 1, fontSize: 13, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{value}</span>
    </div>
  );
}
const Empty = () => <div style={{ textAlign: "center", padding: "24px 0", color: MUTED, fontSize: 12.5 }}>Aucune donnée.</div>;
const th = { padding: "6px 8px", fontWeight: 600 };
const td = { padding: "9px 8px" };
