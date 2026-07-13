import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Users, Star, Coins, AlertTriangle } from "lucide-react";
import { Card, SectionHeader } from "../ui";
import { adminService } from "../../services/admin.service.js";
import RestaurateurDetail from "./RestaurateurDetail.jsx";

const P = "#E8A045", DARK = "#1E2E28", MUTED = "#9BA89F", BORDER = "#E8E2D9", GREEN = "#1D9E75", BG = "#F8F5EF";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmtF = (n) => (Number(n) || 0).toLocaleString("fr-FR") + " F";
const fmtInt = (n) => (Number(n) || 0).toLocaleString("fr-FR");
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "jamais";

const PERIODS = [["week", "Semaine"], ["month", "Mois"], ["year", "Année"], ["all", "Tout"]];
const METRICS = [
  { key: "by_reservations", label: "Réservations", icon: Trophy,  fmt: fmtInt, suffix: "" },
  { key: "by_covers",       label: "Couverts",     icon: Users,   fmt: fmtInt, suffix: "" },
  { key: "by_rating",       label: "Note",         icon: Star,    fmt: (v) => `${v}/5`, suffix: "" },
  { key: "by_revenue",      label: "CA (QR)",      icon: Coins,   fmt: fmtF,   suffix: "" },
];
const MEDALS = ["#E8A045", "#B9B9B9", "#CD9B6A"];

export default function Classements() {
  const [period, setPeriod] = useState("month");
  const [metric, setMetric] = useState("by_reservations");
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    setLoading(true);
    adminService.getTopRestaurants(period)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [period]);

  const M = METRICS.find(m => m.key === metric);
  const list = (data?.[metric] || []);
  const inactive = data?.inactive || [];

  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <SectionHeader title="Classement des restaurants" icon={Trophy} />
          <div style={{ display: "flex", gap: 4 }}>
            {PERIODS.map(([k, lbl]) => (
              <button key={k} onClick={() => setPeriod(k)}
                style={{ fontSize: 11, padding: "4px 11px", borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                  border: `0.5px solid ${period === k ? P : BORDER}`, background: period === k ? "#FEF6EC" : "white",
                  color: period === k ? "#C47D1A" : MUTED, fontWeight: period === k ? 600 : 400 }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Onglets métrique */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {METRICS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setMetric(key)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px", borderRadius: 9,
                cursor: "pointer", fontFamily: FONT, border: "none",
                background: metric === key ? DARK : "white", color: metric === key ? "white" : "#666",
                boxShadow: metric === key ? "none" : `inset 0 0 0 0.5px ${BORDER}` }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>Chargement…</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 13 }}>
            Aucune donnée sur cette période.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {list.map((x, i) => (
              <motion.div key={x.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px",
                  background: i < 3 ? "#FEFBF5" : "white", border: `0.5px solid ${BORDER}`, borderRadius: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                  background: i < 3 ? MEDALS[i] : "#EFEBE4", color: i < 3 ? "white" : MUTED }}>{i + 1}</div>
                <button onClick={() => setDetailId(x.id)}
                  style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer",
                    fontFamily: FONT, padding: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#C47D1A", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{x.ville || "—"}{metric === "by_rating" && x.review_count ? ` · ${x.review_count} avis` : ""}</div>
                </button>
                <div style={{ fontSize: 15, fontWeight: 800, color: metric === "by_revenue" ? GREEN : DARK }}>
                  {M.fmt(x.value)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* À surveiller */}
      {inactive.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Card>
            <SectionHeader title="À relancer — actifs sans réservation depuis 30 jours" icon={AlertTriangle} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              {inactive.map(x => (
                <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  background: "#FBF4EC", border: "0.5px solid #F0D9B8", borderRadius: 10 }}>
                  <AlertTriangle size={14} color="#C47D1A" style={{ flexShrink: 0 }} />
                  <button onClick={() => setDetailId(x.id)}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: FONT, padding: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#C47D1A" }}>{x.name}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{x.ville || "—"}</div>
                  </button>
                  <div style={{ fontSize: 11, color: MUTED, textAlign: "right" }}>
                    Dernière résa<br /><strong style={{ color: DARK }}>{fmtDate(x.last_resa)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {detailId && <RestaurateurDetail id={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}
