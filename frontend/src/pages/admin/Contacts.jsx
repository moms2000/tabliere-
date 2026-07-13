import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, Search, Download, Phone, Mail, Users as UsersIcon } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Table } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const P = "#E8A045", DARK = "#1E2E28", BORDER = "#E8E2D9", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const SOURCE_BADGE = { client: "green", réservation: "blue", commande: "amber" };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export default function Contacts() {
  const [data,     setData]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const [exporting, setExporting] = useState(false);
  const LIMIT = 40;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Débounce recherche (300 ms) → filtre serveur
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => {
    setLoading(true);
    adminService.listContacts({ limit: LIMIT, page, search: search || undefined })
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search]);

  const handleExport = async () => {
    setExporting(true);
    try { await adminService.exportCSV("contacts"); }
    catch (e) { alert("Export impossible : " + (e?.response?.data?.message || e.message)); }
    finally { setExporting(false); }
  };

  const cols = [
    { key: "name", label: "Nom", render: c => (
      <span style={{ fontWeight: 600, fontSize: 13, color: DARK }}>{c.name || "—"}</span>
    )},
    { key: "contact", label: "Contact", render: c => (
      <div>
        {c.phone && <div style={{ display: "flex", alignItems: "center", gap: 5, color: DARK, fontSize: 12.5 }}>
          <Phone size={11} color={MUTED} /> {c.phone}</div>}
        {c.email && <div style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: 12 }}>
          <Mail size={11} /> {c.email}</div>}
        {!c.phone && !c.email && <span style={{ color: MUTED }}>—</span>}
      </div>
    )},
    { key: "notes", label: "Notes", render: c => (
      <span style={{ fontSize: 12, color: c.notes ? "#6B7A70" : MUTED, maxWidth: 240, display: "inline-block",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}
        title={c.notes || ""}>{c.notes || "—"}</span>
    )},
    { key: "sources", label: "Source", render: c => (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(c.sources || "").split(", ").filter(Boolean).map(s => (
          <Badge key={s} label={s} variant={SOURCE_BADGE[s] || "gray"} />
        ))}
      </div>
    )},
    { key: "interactions", label: "Interactions", align: "center", render: c => (
      <span style={{ fontWeight: 600, fontSize: 13 }}>{c.interactions || 0}</span>
    )},
    { key: "last_seen", label: "Dernière activité", render: c => (
      <span style={{ fontSize: 12, color: MUTED }}>{fmtDate(c.last_seen)}</span>
    )},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <PageTitle title="Base de données" subtitle="Tous les contacts : clients inscrits, invités (réservations & commandes)" />
          <button onClick={handleExport} disabled={exporting}
            style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px",
              border: "none", borderRadius: 9, background: P, color: "#1A1000",
              cursor: exporting ? "default" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: FONT }}>
            <Download size={14} /> {exporting ? "Export…" : "Exporter CSV"}
          </button>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160, background: "white", border: `0.5px solid ${BORDER}`,
          borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, color: MUTED }}>Contacts uniques</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: DARK }}>{total}</span>
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <SectionHeader title="Répertoire" icon={Database} />
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
                transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Nom, téléphone, email…"
                style={{ paddingLeft: 28, paddingRight: 10, height: 32, border: `0.5px solid ${BORDER}`,
                  borderRadius: 8, fontSize: 12, outline: "none", color: DARK, width: 240, fontFamily: FONT }} />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 13 }}>Chargement…</div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>
              <UsersIcon size={30} color={BORDER} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13 }}>
                {search ? `Aucun contact pour « ${search} »` : "Aucun contact pour le moment."}
              </div>
            </div>
          ) : (
            <Table columns={cols} rows={data} />
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 14px", background: "white",
                  cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: 13, fontFamily: FONT }}>← Préc.</button>
              <span style={{ fontSize: 13, color: MUTED }}>Page {page} / {totalPages} · {total} contacts</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 14px", background: "white",
                  cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: 13, fontFamily: FONT }}>Suiv. →</button>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
