import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, MapPin, UtensilsCrossed, Zap } from "lucide-react";
import { Card, SectionHeader } from "../ui";
import { adminService } from "../../services/admin.service.js";

const P = "#E8A045", DARK = "#1E2E28", MUTED = "#9BA89F", BORDER = "#E8E2D9", GREEN = "#1D9E75", BG = "#F8F5EF";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
const moLabel = (m) => { const mo = parseInt((m || "").split("-")[1], 10); return MONTHS[mo - 1] || m; };

// Barres verticales (croissance)
function GrowthBars({ restos, clients }) {
  const months = [...new Set([...(restos || []).map(x => x.month), ...(clients || []).map(x => x.month)])].sort();
  const rMap = Object.fromEntries((restos || []).map(x => [x.month, x.count]));
  const cMap = Object.fromEntries((clients || []).map(x => [x.month, x.count]));
  const max = Math.max(1, ...months.map(m => Math.max(rMap[m] || 0, cMap[m] || 0)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 110, marginTop: 6 }}>
        {months.map((m, i) => (
          <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 84, width: "100%", justifyContent: "center" }}>
              <motion.div initial={{ height: 0 }} animate={{ height: `${((rMap[m] || 0) / max) * 100}%` }} transition={{ delay: i * 0.04 }}
                title={`${rMap[m] || 0} restos`} style={{ width: 12, background: P, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
              <motion.div initial={{ height: 0 }} animate={{ height: `${((cMap[m] || 0) / max) * 100}%` }} transition={{ delay: i * 0.04 + 0.02 }}
                title={`${cMap[m] || 0} clients`} style={{ width: 12, background: GREEN, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
            </div>
            <span style={{ fontSize: 9.5, color: "#aaa" }}>{moLabel(m)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: MUTED }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: P }} /> Restaurants</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: GREEN }} /> Clients</span>
      </div>
    </div>
  );
}

// Liste barres horizontales (répartition)
function BarList({ rows, color = P }) {
  const max = Math.max(1, ...(rows || []).map(x => x.count));
  if (!rows?.length) return <div style={{ fontSize: 12.5, color: MUTED, padding: "10px 0" }}>Aucune donnée.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
      {rows.map((x, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 96, fontSize: 12, color: DARK, textTransform: "capitalize", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.label}</span>
          <div style={{ flex: 1, background: "#F0ECE4", borderRadius: 5, height: 10, overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(x.count / max) * 100}%` }} transition={{ delay: i * 0.03 }}
              style={{ height: "100%", background: color, borderRadius: 5 }} />
          </div>
          <span style={{ width: 40, textAlign: "right", fontSize: 12, fontWeight: 700, color: DARK }}>{x.count}</span>
        </div>
      ))}
    </div>
  );
}

// Barre d'adoption (pourcentage)
function Adopt({ label, value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: DARK }}>{label}</span>
        <span style={{ color: MUTED }}><strong style={{ color: DARK }}>{value}</strong> / {total} · {pct}%</span>
      </div>
      <div style={{ background: "#F0ECE4", borderRadius: 6, height: 9, overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} style={{ height: "100%", background: P, borderRadius: 6 }} />
      </div>
    </div>
  );
}

export default function PlatformStats() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getPlatformStats().then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Card><div style={{ textAlign: "center", padding: "24px 0", color: MUTED, fontSize: 13 }}>Chargement des statistiques…</div></Card>;
  if (!d) return null;

  const a = d.adoption || {}, acc = d.accounts || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Comptes */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { label: "Restaurants", val: a.total || 0, color: DARK },
          { label: "Actifs", val: a.active || 0, color: GREEN },
          { label: "Suspendus", val: a.suspended || 0, color: "#993C1D" },
          { label: "Clients", val: acc.clients || 0, color: P },
          { label: "Restaurateurs", val: acc.restaurateurs || 0, color: "#185FA5" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 120, background: "white", border: `0.5px solid ${BORDER}`,
            borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: MUTED }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{Number(s.val).toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <Card>
          <SectionHeader title="Croissance — 6 derniers mois" icon={TrendingUp} />
          <GrowthBars restos={d.resto_growth} clients={d.client_growth} />
        </Card>

        <Card>
          <SectionHeader title="Adoption des fonctionnalités" icon={Zap} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <Adopt label="QR Menu activé" value={a.qr || 0} total={a.total || 0} />
            <Adopt label="Menu rempli" value={a.with_menu || 0} total={a.total || 0} />
            <Adopt label="Menu public affiché" value={a.menu_public || 0} total={a.total || 0} />
            <Adopt label="Instants activés" value={a.stories || 0} total={a.total || 0} />
            <Adopt label="Acompte configuré" value={a.deposit || 0} total={a.total || 0} />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Répartition par ville" icon={MapPin} />
          <BarList rows={d.by_ville} color={P} />
        </Card>

        <Card>
          <SectionHeader title="Répartition par cuisine" icon={UtensilsCrossed} />
          <BarList rows={d.by_cuisine} color={GREEN} />
        </Card>
      </div>
    </div>
  );
}
