import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, FileText, Sheet, Search, Phone, Mail, Download } from "lucide-react";
import { Card, PageTitle, Btn } from "../../components/ui";
import { reservationsService } from "../../services/reservations.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.26 } } };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export default function RestClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [totals, setTotals] = useState({ clients: 0, visits: 0, covers: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  useEffect(() => {
    reservationsService.clients()
      .then(d => { setClients(d?.clients || []); setTotals(d?.totals || { clients: 0, visits: 0, covers: 0 }); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter(c =>
      (c.name || "").toLowerCase().includes(s) ||
      (c.phone || "").toLowerCase().includes(s) ||
      (c.email || "").toLowerCase().includes(s));
  }, [clients, q]);

  // Pagination client (les données + la recherche sont déjà côté client ;
  // les exports PDF/Excel restent sur l'ensemble filtré, pas la page courante).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const restoName = user?.resto_name || "Mon restaurant";
  const COLS = ["Nom", "Téléphone", "Email", "Visites", "Couverts", "Confirmées", "No-show", "1re visite", "Dernière visite"];
  const toRows = (list) => list.map(c => [
    c.name, c.phone || "", c.email || "", c.visits, c.total_covers, c.confirmed, c.no_shows, fmtDate(c.first_visit), fmtDate(c.last_visit),
  ]);

  const exportPdf = async () => {
    setBusy("pdf");
    try {
      const { exportPDF } = await import("../../services/exports.js");
      await exportPDF({
        title: "Base clients", subtitle: restoName,
        columns: COLS, rows: toRows(filtered),
        filename: `clients-${(user?.resto_slug || "resto")}`,
        summary: [
          { label: "Clients", value: totals.clients },
          { label: "Visites", value: totals.visits },
          { label: "Couverts", value: totals.covers },
        ],
      });
    } catch (e) { alert("Export PDF impossible"); console.error(e); }
    finally { setBusy(null); }
  };
  const exportXls = async () => {
    setBusy("xls");
    try {
      const { exportXLSX } = await import("../../services/exports.js");
      await exportXLSX({
        sheetName: "Clients", title: "Base clients", subtitle: restoName,
        columns: COLS, rows: toRows(filtered),
        filename: `clients-${(user?.resto_slug || "resto")}`,
      });
    } catch (e) { alert("Export Excel impossible"); console.error(e); }
    finally { setBusy(null); }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <PageTitle title="Mes clients" subtitle="Votre base clients, issue de vos réservations" />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn icon={FileText} onClick={exportPdf} disabled={busy || !clients.length}>{busy === "pdf" ? "…" : "PDF"}</Btn>
          <Btn icon={Sheet} onClick={exportXls} disabled={busy || !clients.length}>{busy === "xls" ? "…" : "Excel"}</Btn>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Clients", val: totals.clients, color: DARK },
          { label: "Visites", val: totals.visits, color: GREEN },
          { label: "Couverts servis", val: totals.covers, color: P },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 120, background: "white", border: `0.5px solid ${BORDER}`,
            borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, color: MUTED }}>{s.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
            border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px", background: BG, maxWidth: 340 }}>
            <Search size={15} color={MUTED} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un client…"
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1, color: DARK, fontFamily: FONT }} />
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "50px 0", color: MUTED, fontSize: 13 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "44px 0", color: MUTED }}>
              <Users size={30} color={BORDER} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13 }}>{clients.length ? "Aucun résultat." : "Aucun client pour le moment — vos réservations alimenteront cette base."}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>
                    <th style={th}>Client</th><th style={th}>Contact</th>
                    <th style={{ ...th, textAlign: "center" }}>Visites</th>
                    <th style={{ ...th, textAlign: "center" }}>Couverts</th>
                    <th style={{ ...th, textAlign: "center" }}>No-show</th>
                    <th style={th}>Dernière visite</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c, i) => (
                    <tr key={i} style={{ borderTop: `0.5px solid ${BG}` }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: DARK }}>{c.name}</div>
                      </td>
                      <td style={td}>
                        {c.phone && <div style={{ display: "flex", alignItems: "center", gap: 5, color: DARK }}><Phone size={11} color={MUTED} /> {c.phone}</div>}
                        {c.email && <div style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: 12 }}><Mail size={11} /> {c.email}</div>}
                        {!c.phone && !c.email && <span style={{ color: MUTED }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{c.visits}</td>
                      <td style={{ ...td, textAlign: "center" }}>{c.total_covers}</td>
                      <td style={{ ...td, textAlign: "center", color: c.no_shows ? "#DC2626" : MUTED }}>{c.no_shows || "—"}</td>
                      <td style={{ ...td, color: MUTED }}>{fmtDate(c.last_visit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination (client) */}
          {!loading && filtered.length > PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 14px", background: "white",
                  cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: 13, fontFamily: FONT }}>← Préc.</button>
              <span style={{ fontSize: 13, color: MUTED }}>Page {page} / {totalPages} · {filtered.length} clients</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 14px", background: "white",
                  cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: 13, fontFamily: FONT }}>Suiv. →</button>
            </div>
          )}
        </Card>
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={12} /> Exports PDF & Excel brandés TablièreCI — {filtered.length} client(s) exporté(s).
        </div>
      </motion.div>
    </motion.div>
  );
}

const th = { padding: "6px 8px", fontWeight: 600 };
const td = { padding: "10px 8px", verticalAlign: "top" };
