import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils, Search, FileText, Sheet, CheckSquare, Square, X } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";
import { runAdminExport } from "../../services/adminExport.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const PLAN_BADGE   = { premium: "green", standard: "blue", gratuit: "gray" };
const STATUS_BADGE = { actif: "green", suspendu: "red", en_attente: "amber", "en attente": "amber" };

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("fr-FR") : "—";

export default function Restaurateurs() {
  const [data,      setData]      = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState(new Set());
  const [exporting, setExporting] = useState(null); // "pdf" | "xls" | null
  const [batching,  setBatching]  = useState(false);
  const [page,      setPage]      = useState(1);
  const LIMIT = 50;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => {
    setSelected(new Set()); setLoading(true);
    adminService.listRestaurants({ search: search || undefined, limit: LIMIT, page })
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, page]);

  const setStatus = async (id, status) => {
    try {
      await adminService.setRestaurantStatus(id, status);
      setData(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) { console.error(e); }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map(r => r.id)));
  };

  const batchAction = async (status) => {
    setBatching(true);
    try {
      await adminService.batchRestaurantStatus([...selected], status);
      setData(prev => prev.map(r => selected.has(r.id) ? { ...r, status } : r));
      setSelected(new Set());
    } catch (e) { console.error(e); }
    setBatching(false);
  };

  const handleExport = async (kind) => {
    setExporting(kind);
    try {
      const { total, exported } = await runAdminExport("restaurants", kind, { title: "Restaurants", filename: "restaurants" });
      if (kind === "pdf" && exported < total) alert(`PDF limité aux ${exported} premières lignes. Utilisez Excel pour les ${total} restaurants.`);
    } catch (e) { alert("Export impossible : " + (e?.response?.data?.message || e.message)); console.error(e); }
    setExporting(null);
  };

  const allChecked = data.length > 0 && selected.size === data.length;

  const cols = [
    {
      key: "check", label: () => (
        <button onClick={toggleAll} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          {allChecked ? <CheckSquare size={15} color="#e8a045" /> : <Square size={15} color="#ccc" />}
        </button>
      ),
      render: r => (
        <button onClick={() => toggleSelect(r.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          {selected.has(r.id) ? <CheckSquare size={15} color="#e8a045" /> : <Square size={15} color="#ddd" />}
        </button>
      ),
    },
    { key: "name",   label: "Restaurant", render: r => (
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div>
        <div style={{ fontSize: 11, color: "#aaa" }}>{r.quartier ? `${r.quartier}, ` : ""}{r.ville}</div>
      </div>
    )},
    { key: "owner",  label: "Gérant",      render: r => <span style={{ fontSize: 13 }}>{r.owner_name || "—"}</span> },
    { key: "plan",   label: "Plan",         render: r => <Badge label={r.plan || "gratuit"} variant={PLAN_BADGE[r.plan] || "gray"} /> },
    { key: "status", label: "Statut",       render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /> },
    { key: "reserv", label: "Réservations", align: "right", render: r => <span style={{ fontWeight: 500 }}>{r.resa_count || 0}</span> },
    { key: "rating", label: "Note",         align: "center", render: r => (
      <span style={{ fontSize: 13 }}>{r.rating > 0 ? `${r.rating}/5` : "—"}</span>
    )},
    { key: "joined", label: "Depuis",       render: r => <span style={{ fontSize: 11, color: "#999" }}>{fmtDate(r.created_at)}</span> },
    { key: "actions",label: "",             align: "right", render: r => (
      <div style={{ display: "flex", gap: 4 }}>
        {r.status !== "actif" && (
          <Btn onClick={() => setStatus(r.id, "actif")} variant="primary"
            style={{ fontSize: 11, padding: "3px 8px" }}>Activer</Btn>
        )}
        {r.status !== "suspendu" && (
          <Btn onClick={() => setStatus(r.id, "suspendu")} variant="danger"
            style={{ fontSize: 11, padding: "3px 8px" }}>Suspendre</Btn>
        )}
      </div>
    )},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Restaurateurs" subtitle={`${total} restaurants inscrits`} />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Actifs",     val: data.filter(r => r.status === "actif").length,                  color: "#1D9E75" },
          { label: "Suspendus",  val: data.filter(r => r.status === "suspendu").length,               color: "#993C1D" },
          { label: "En attente", val: data.filter(r => ["en_attente","en attente"].includes(r.status)).length, color: "#854F0B" },
          { label: "Total",      val: total,                                                           color: "#1a1a1a" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
            <SectionHeader title="Liste des restaurants" icon={Utensils} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
                  transform: "translateY(-50%)", color: "#bbb" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{ paddingLeft: 28, paddingRight: 10, height: 32, border: "0.5px solid #eee",
                    borderRadius: 8, fontSize: 12, outline: "none", color: "#333", width: 200 }} />
              </div>
              <button onClick={() => handleExport("pdf")} disabled={!!exporting}
                style={{ display: "flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px",
                  border: "0.5px solid #e4dfd8", borderRadius: 8, background: "white",
                  cursor: exporting ? "default" : "pointer", fontSize: 12, color: "#666" }}>
                <FileText size={13} />{exporting === "pdf" ? "…" : "PDF"}
              </button>
              <button onClick={() => handleExport("xls")} disabled={!!exporting}
                style={{ display: "flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px",
                  border: "0.5px solid #e4dfd8", borderRadius: 8, background: "white",
                  cursor: exporting ? "default" : "pointer", fontSize: 12, color: "#666" }}>
                <Sheet size={13} />{exporting === "xls" ? "…" : "Excel"}
              </button>
            </div>
          </div>

          {/* Barre de sélection batch */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                  background: "#fef6ec", borderRadius: 8, border: "0.5px solid #f0c98a", fontSize: 13 }}>
                  <span style={{ color: "#c47d1a", fontWeight: 600 }}>{selected.size} sélectionné(s)</span>
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    <button onClick={() => batchAction("actif")} disabled={batching}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none",
                        background: "#1D9E75", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Activer
                    </button>
                    <button onClick={() => batchAction("suspendu")} disabled={batching}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none",
                        background: "#dc2626", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Suspendre
                    </button>
                    <button onClick={() => batchAction("en_attente")} disabled={batching}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none",
                        background: "#92400e", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      En attente
                    </button>
                    <button onClick={() => setSelected(new Set())}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "0.5px solid #e4dfd8",
                        background: "white", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <X size={13} color="#888" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>Chargement…</div>
          ) : (
            <Table columns={cols} rows={data} />
          )}
          {!loading && data.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
              Aucun restaurant trouvé
            </div>
          )}
          {/* Pagination */}
          {total > LIMIT && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ border: "0.5px solid #eee", borderRadius: 8, padding: "6px 14px", background: "white",
                  cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}>← Préc.</button>
              <span style={{ fontSize: 13, color: "#888" }}>Page {page} / {totalPages} · {total} restaurants</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ border: "0.5px solid #eee", borderRadius: 8, padding: "6px 14px", background: "white",
                  cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: 13 }}>Suiv. →</button>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
