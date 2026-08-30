import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, Download, TrendingUp, Receipt, Wallet } from "lucide-react";
import { sessionsService } from "../../services/sessions.service.js";
import { fmtMoney } from "../../utils/printer.js";

const P = "#E8A045"; const PL = "#FEF6EC"; const DARK = "#1E2E28"; const BG = "#F8F5EF";
const BORDER = "#E4DFD8"; const MUTED = "#9BA89F"; const GREEN = "#3D6B55";
const FONT = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

// Moyens de paiement : libellé + couleur (repères visuels pour lire vite quel
// moyen domine). Couleurs proches des marques pour la reconnaissance.
const METHOD_META = {
  especes: { label: "Espèces",      color: "#3D6B55" },
  wave:    { label: "Wave",         color: "#1DAFE3" },
  orange:  { label: "Orange Money", color: "#FF7900" },
  mtn:     { label: "MTN",          color: "#F5C400" },
  moov:    { label: "Moov",         color: "#1263F5" },
  carte:   { label: "Carte",        color: "#7A5AF8" },
};
const methodLabel = (m) => METHOD_META[m]?.label || m;
const methodColor = (m) => METHOD_META[m]?.color || MUTED;

const toYMD = (d) => {
  const z = new Date(d);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
};
const RANGES = [
  { key: "today", label: "Aujourd'hui" },
  { key: "7d",    label: "7 jours" },
  { key: "30d",   label: "30 jours" },
  { key: "custom", label: "Personnalisé" },
];
function rangeToDates(key, from, to) {
  const now = new Date();
  if (key === "today") return { from: toYMD(now), to: toYMD(now) };
  if (key === "7d")    return { from: toYMD(new Date(now.getTime() - 6 * 86400000)), to: toYMD(now) };
  if (key === "30d")   return { from: toYMD(new Date(now.getTime() - 29 * 86400000)), to: toYMD(now) };
  return { from, to }; // custom
}

export default function RestCaisseHistorique() {
  const [rangeKey, setRangeKey] = useState("today");
  const [from, setFrom] = useState(toYMD(new Date()));
  const [to,   setTo]   = useState(toYMD(new Date()));
  const [stats,   setStats]   = useState(null);
  const [rows,    setRows]    = useState([]);
  const [total,   setTotalC]  = useState(0);
  const [page,    setPage]    = useState(1);
  const [method,  setMethod]  = useState("");     // filtre moyen de paiement
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const LIMIT = 50;

  const dates = useMemo(() => rangeToDates(rangeKey, from, to), [rangeKey, from, to]);

  const loadStats = useCallback(async () => {
    try { setStats(await sessionsService.analytics(dates)); } catch (_) { setStats(null); }
  }, [dates.from, dates.to]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sessionsService.history({ ...dates, method: method || undefined, page, limit: LIMIT });
      setRows(res?.data || []);
      setTotalC(res?.pagination?.total || 0);
    } catch (_) { setRows([]); setTotalC(0); }
    setLoading(false);
  }, [dates.from, dates.to, method, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { setPage(1); }, [rangeKey, from, to, method]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const grandTotal = stats?.total || 0;
  const byMethod = stats?.by_method || [];
  const topMethod = byMethod[0];
  const byDay = stats?.by_day || [];
  const maxDay = Math.max(1, ...byDay.map(d => d.amount));

  // Export CSV : récupère toutes les lignes de la plage (par pages) puis télécharge.
  const exportCsv = async () => {
    setExporting(true);
    try {
      let all = [], p = 1;
      for (;;) {
        const res = await sessionsService.history({ ...dates, method: method || undefined, page: p, limit: 200 });
        const batch = res?.data || [];
        all = all.concat(batch);
        const tot = res?.pagination?.total || all.length;
        if (all.length >= tot || batch.length === 0 || p >= 40) break;
        p++;
      }
      // Échappe une cellule CSV : neutralise l'injection de formule (une cellule
      // commençant par = + - @ ou tab/CR est exécutée par Excel/Sheets) PUIS met
      // entre guillemets. Nom du convive et n° de table sont saisis par des tiers.
      const esc = (v) => {
        let s = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return `"${s.replace(/"/g, '""')}"`;
      };
      const head = ["Date", "Heure", "Table", "Convive", "Moyen", "Montant (FCFA)", "Réf"];
      const lines = all.map(r => {
        const d = new Date(r.created_at);
        return [
          d.toLocaleDateString("fr-FR"),
          d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          r.table_label || "",
          r.convive_name || "",
          methodLabel(r.method),
          r.amount,
          r.ref || "",
        ].map(esc).join(",");
      });
      const csv = "﻿" + [head.join(","), ...lines].join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `encaissements_${dates.from}_${dates.to}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (_) { alert("Export impossible. Réessayez."); }
    setExporting(false);
  };

  return (
    <div>
      {/* Sélecteur de plage */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Calendar size={16} color={MUTED} />
        {RANGES.map(r => (
          <button key={r.key} onClick={() => setRangeKey(r.key)}
            style={{ padding: "6px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: rangeKey === r.key ? 700 : 500,
              border: `0.5px solid ${rangeKey === r.key ? P : BORDER}`, background: rangeKey === r.key ? PL : "white",
              color: rangeKey === r.key ? "#C47D1A" : MUTED, fontFamily: FONT }}>
            {r.label}
          </button>
        ))}
        {rangeKey === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={dateInp} />
            <span style={{ color: MUTED, fontSize: 12 }}>au</span>
            <input type="date" value={to} min={from} max={toYMD(new Date())} onChange={e => setTo(e.target.value)} style={dateInp} />
          </div>
        )}
        <button onClick={exportCsv} disabled={exporting || grandTotal === 0}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9,
            border: `0.5px solid ${BORDER}`, background: "white", fontSize: 12.5, cursor: grandTotal === 0 ? "default" : "pointer",
            color: grandTotal === 0 ? BORDER : DARK, fontFamily: FONT }}>
          <Download size={13} /> {exporting ? "…" : "Exporter CSV"}
        </button>
      </div>

      {/* Cartes de synthèse */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
        <Card icon={Wallet} label="Total encaissé" value={fmtMoney(grandTotal)} accent={P} />
        <Card icon={Receipt} label="Encaissements" value={String(stats?.count || 0)} accent={GREEN} />
        <Card icon={TrendingUp} label="Moyen n°1"
          value={topMethod ? methodLabel(topMethod.method) : "—"}
          sub={topMethod && grandTotal ? `${Math.round(topMethod.amount / grandTotal * 100)}% · ${fmtMoney(topMethod.amount)}` : ""}
          accent={topMethod ? methodColor(topMethod.method) : MUTED} />
      </div>

      {/* Répartition par moyen de paiement */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: DARK, marginBottom: 12 }}>Répartition par moyen de paiement</div>
        {byMethod.length === 0 ? (
          <div style={{ fontSize: 13, color: MUTED, padding: "8px 0" }}>Aucun encaissement sur cette période.</div>
        ) : byMethod.map(m => {
          const pct = grandTotal ? Math.round(m.amount / grandTotal * 100) : 0;
          return (
            <div key={m.method} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: methodColor(m.method), display: "inline-block" }} />
                  {methodLabel(m.method)}
                  <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 500 }}>· {m.count} encaissement(s)</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: DARK }}>{fmtMoney(m.amount)} <span style={{ color: MUTED, fontWeight: 600, fontSize: 12 }}>({pct}%)</span></span>
              </div>
              <div style={{ height: 9, background: BG, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: methodColor(m.method), borderRadius: 6, transition: "width .3s" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Évolution par jour (si plage > 1 jour) */}
      {byDay.length > 1 && (
        <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: DARK, marginBottom: 14 }}>Encaissements par jour</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, overflowX: "auto", paddingBottom: 4 }}>
            {byDay.map(d => {
              const h = Math.round((d.amount / maxDay) * 96) + 2;
              const dd = new Date(d.day + "T00:00:00");
              return (
                <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 34 }}
                  title={`${dd.toLocaleDateString("fr-FR")} : ${fmtMoney(d.amount)} (${d.count})`}>
                  <div style={{ width: 22, height: h, background: P, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 9.5, color: MUTED, whiteSpace: "nowrap" }}>{dd.getDate()}/{dd.getMonth() + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des encaissements (reçus) */}
      <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: DARK }}>Historique des encaissements</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <FilterChip active={method === ""} onClick={() => setMethod("")}>Tous</FilterChip>
            {Object.keys(METHOD_META).map(k => (
              <FilterChip key={k} active={method === k} color={methodColor(k)} onClick={() => setMethod(k)}>{methodLabel(k)}</FilterChip>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: MUTED, fontSize: 13 }}>Chargement…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: MUTED, fontSize: 13 }}>Aucun encaissement sur cette période.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: MUTED, fontSize: 11 }}>
                  <th style={th}>Date / heure</th><th style={th}>Table</th><th style={th}>Convive</th>
                  <th style={th}>Moyen</th><th style={{ ...th, textAlign: "right" }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const d = new Date(r.created_at);
                  return (
                    <tr key={r.ref} style={{ borderTop: `0.5px solid ${BG}` }}>
                      <td style={td}>{d.toLocaleDateString("fr-FR")} <span style={{ color: MUTED }}>{d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></td>
                      <td style={td}>{r.table_label || "—"}</td>
                      <td style={td}>{r.convive_name || "—"}</td>
                      <td style={td}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: methodColor(r.method) }} />
                          {methodLabel(r.method)}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: DARK }}>{fmtMoney(r.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={pageBtn(page <= 1)}>Précédent</button>
            <span style={{ fontSize: 12, color: MUTED }}>Page {page} / {totalPages} · {total} encaissement(s)</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={pageBtn(page >= totalPages)}>Suivant</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, sub, accent }) {
  return (
    <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Icon size={15} color={accent} />
        <span style={{ fontSize: 11.5, color: MUTED }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: DARK, lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

function FilterChip({ active, color = P, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: "5px 11px", borderRadius: 20, cursor: "pointer", fontSize: 11.5, fontWeight: active ? 700 : 500,
        border: `1px solid ${active ? color : BORDER}`, background: active ? color + "1A" : "white",
        color: active ? color : MUTED, fontFamily: FONT }}>
      {children}
    </button>
  );
}

const dateInp = { border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 9px", fontSize: 12.5, background: "white", fontFamily: FONT, color: DARK, outline: "none" };
const th = { padding: "6px 8px", fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "8px", color: "#333", whiteSpace: "nowrap" };
const pageBtn = (disabled) => ({ padding: "6px 14px", borderRadius: 8, border: `0.5px solid ${BORDER}`, background: "white",
  color: disabled ? BORDER : DARK, fontSize: 12, cursor: disabled ? "default" : "pointer", fontFamily: FONT });
