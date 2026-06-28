import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, ShieldOff, ShieldCheck, Download,
  CheckSquare, Square, X, Trash2, ChevronLeft, ChevronRight,
  ArrowUpAZ, ArrowDownAZ, Clock,
} from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

// "suspendu" en DB = "bloqué" côté UI
const displayStatus = (s) => (s === "suspendu" ? "bloqué" : s);
const STATUS_BADGE = { actif: "green", bloque: "red", bloqué: "red", suspendu: "red" };

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("fr-FR") : "—";

const SORT_OPTIONS = [
  { value: "name",   label: "A → Z",    icon: ArrowUpAZ },
  { value: "recent", label: "Plus récent", icon: Clock },
  { value: "old",    label: "Plus ancien", icon: ArrowDownAZ },
];

export default function Utilisateurs() {
  const [data,      setData]      = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [sort,      setSort]      = useState("name");
  const [page,      setPage]      = useState(1);
  const [selected,  setSelected]  = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [batching,  setBatching]  = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  const LIMIT = 30;
  const totalPages = Math.ceil(total / LIMIT);

  const load = useCallback(() => {
    setLoading(true);
    adminService.listUsers({ search: search || undefined, role: "client", limit: LIMIT, page, sort })
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, sort, page]);

  useEffect(() => { setSelected(new Set()); setPage(1); }, [search, sort]);
  useEffect(() => { load(); }, [load]);

  const toggleBlock = async (user) => {
    const isBlocked = ["suspendu","bloque","bloqué"].includes(user.status);
    const newStatus = isBlocked ? "actif" : "bloque";
    try {
      await adminService.setUserStatus(user.id, newStatus);
      setData(prev => prev.map(u => u.id === user.id
        ? { ...u, status: isBlocked ? "actif" : "suspendu" } : u));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Supprimer définitivement le compte de ${user.full_name} ?`)) return;
    setDeleting(user.id);
    try {
      await adminService.deleteUser(user.id);
      setData(prev => prev.filter(u => u.id !== user.id));
      setTotal(p => p - 1);
    } catch (e) { alert(e.response?.data?.message || "Erreur lors de la suppression"); }
    setDeleting(null);
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () =>
    setSelected(selected.size === data.length ? new Set() : new Set(data.map(u => u.id)));

  const batchAction = async (status) => {
    setBatching(true);
    try {
      await adminService.batchUserStatus([...selected], status);
      const dbStatus = status === "bloque" ? "suspendu" : status;
      setData(prev => prev.map(u => selected.has(u.id) ? { ...u, status: dbStatus } : u));
      setSelected(new Set());
    } catch (e) { console.error(e); }
    setBatching(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try { await adminService.exportCSV("users"); } catch (e) { console.error(e); }
    setExporting(false);
  };

  const allChecked = data.length > 0 && selected.size === data.length;

  const cols = [
    {
      key: "check",
      label: () => (
        <button onClick={toggleAll} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          {allChecked ? <CheckSquare size={15} color="#e8a045" /> : <Square size={15} color="#ccc" />}
        </button>
      ),
      render: u => (
        <button onClick={() => toggleSelect(u.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          {selected.has(u.id) ? <CheckSquare size={15} color="#e8a045" /> : <Square size={15} color="#ddd" />}
        </button>
      ),
    },
    { key: "name",    label: "Utilisateur", render: u => (
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{u.full_name}</div>
        <div style={{ fontSize: 11, color: "#aaa" }}>{u.email}</div>
      </div>
    )},
    { key: "phone",  label: "Téléphone", render: u => <span style={{ fontSize: 12, color: "#888" }}>{u.phone || "—"}</span> },
    { key: "reserv", label: "Réservations", align: "center", render: u => (
      <span style={{ fontWeight: 500 }}>{u.resa_count || 0}</span>
    )},
    { key: "status", label: "Statut", render: u => (
      <Badge label={displayStatus(u.status)} variant={STATUS_BADGE[u.status] || STATUS_BADGE[displayStatus(u.status)] || "gray"} />
    )},
    { key: "joined", label: "Inscrit", render: u => <span style={{ fontSize: 11, color: "#bbb" }}>{fmtDate(u.created_at)}</span> },
    { key: "actions", label: "", align: "right", render: u => {
      const isBlocked = ["suspendu","bloque","bloqué"].includes(u.status);
      return (
        <div style={{ display: "flex", gap: 4 }}>
          <Btn onClick={() => toggleBlock(u)}
            variant={isBlocked ? "default" : "danger"}
            icon={isBlocked ? ShieldCheck : ShieldOff}
            style={{ fontSize: 11, padding: "4px 10px" }}>
            {isBlocked ? "Débloquer" : "Bloquer"}
          </Btn>
          <button onClick={() => handleDelete(u)} disabled={deleting === u.id}
            style={{ padding: "4px 8px", borderRadius: 6, border: "0.5px solid #fecaca",
              background: "#fef2f2", cursor: "pointer", display: "flex", alignItems: "center",
              opacity: deleting === u.id ? 0.5 : 1 }}>
            <Trash2 size={12} color="#dc2626" />
          </button>
        </div>
      );
    }},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Utilisateurs" subtitle={`${total} comptes enregistrés`} />
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Total",   val: total,                                                                color: "#1a1a1a" },
          { label: "Actifs",  val: data.filter(u => u.status === "actif").length,                       color: "#1D9E75" },
          { label: "Bloqués", val: data.filter(u => ["suspendu","bloque"].includes(u.status)).length,   color: "#993C1D" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 110, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
            <SectionHeader title="Liste des utilisateurs" icon={Users} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* Tri */}
              <div style={{ display: "flex", gap: 4 }}>
                {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => setSort(value)}
                    title={label}
                    style={{ display: "flex", alignItems: "center", gap: 4, height: 32, padding: "0 10px",
                      border: `0.5px solid ${sort === value ? "#e8a045" : "#eee"}`,
                      borderRadius: 7, background: sort === value ? "#fef6ec" : "white",
                      color: sort === value ? "#c47d1a" : "#888", cursor: "pointer", fontSize: 12 }}>
                    <Icon size={13} />
                    <span style={{ display: window.innerWidth > 700 ? "inline" : "none" }}>{label}</span>
                  </button>
                ))}
              </div>
              {/* Recherche */}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#bbb" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{ paddingLeft: 28, paddingRight: 10, height: 32, border: "0.5px solid #eee",
                    borderRadius: 8, fontSize: 12, outline: "none", color: "#333", width: 180 }} />
              </div>
              {/* Export */}
              <button onClick={handleExport} disabled={exporting}
                style={{ display: "flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px",
                  border: "0.5px solid #e4dfd8", borderRadius: 8, background: "white",
                  cursor: "pointer", fontSize: 12, color: "#666" }}>
                <Download size={13} />{exporting ? "…" : "CSV"}
              </button>
            </div>
          </div>

          {/* Barre batch */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                  background: "#fef6ec", borderRadius: 8, border: "0.5px solid #f0c98a", fontSize: 13 }}>
                  <span style={{ color: "#c47d1a", fontWeight: 600 }}>{selected.size} sélectionné(s)</span>
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    <button onClick={() => batchAction("actif")} disabled={batching}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#1D9E75", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Activer
                    </button>
                    <button onClick={() => batchAction("bloque")} disabled={batching}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#dc2626", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Bloquer
                    </button>
                    <button onClick={() => setSelected(new Set())}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "0.5px solid #e4dfd8", background: "white", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <X size={13} color="#888" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>Chargement…</div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>Aucun utilisateur trouvé</div>
          ) : (
            <Table columns={cols} rows={data} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid #eee",
                  background: "white", cursor: page === 1 ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, color: "#888" }}>Page {page} / {totalPages} · {total} utilisateurs</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid #eee",
                  background: "white", cursor: page === totalPages ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", opacity: page === totalPages ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
