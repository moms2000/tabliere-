import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, ShieldOff, ShieldCheck, Download, CheckSquare, Square, X } from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE = { actif: "green", bloque: "red", bloqué: "red", suspendu: "red" };

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("fr-FR") : "—";

export default function Utilisateurs() {
  const [data,      setData]      = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [batching,  setBatching]  = useState(false);

  const load = () => {
    adminService.listUsers({ search: search || undefined, role: "client", limit: 50 })
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { setSelected(new Set()); load(); }, [search]);

  const toggleBlock = async (user) => {
    const newStatus = user.status === "actif" ? "bloque" : "actif";
    try {
      await adminService.setUserStatus(user.id, newStatus);
      setData(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (e) { console.error(e); }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map(u => u.id)));
  };

  const batchAction = async (status) => {
    setBatching(true);
    try {
      await adminService.batchUserStatus([...selected], status);
      setData(prev => prev.map(u => selected.has(u.id) ? { ...u, status } : u));
      setSelected(new Set());
    } catch (e) { console.error(e); }
    setBatching(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try { await adminService.exportCSV("users"); }
    catch (e) { console.error(e); }
    setExporting(false);
  };

  const allChecked = data.length > 0 && selected.size === data.length;

  const cols = [
    {
      key: "check", label: () => (
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
    { key: "status", label: "Statut",   render: u => <Badge label={u.status} variant={STATUS_BADGE[u.status] || "gray"} /> },
    { key: "joined", label: "Inscrit",  render: u => <span style={{ fontSize: 11, color: "#bbb" }}>{fmtDate(u.created_at)}</span> },
    { key: "actions",label: "",         align: "right", render: u => (
      <Btn onClick={() => toggleBlock(u)}
        variant={u.status === "actif" ? "danger" : "default"}
        icon={u.status === "actif" ? ShieldOff : ShieldCheck}
        style={{ fontSize: 11, padding: "4px 10px" }}>
        {u.status === "actif" ? "Bloquer" : "Débloquer"}
      </Btn>
    )},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Utilisateurs" subtitle={`${total} comptes enregistrés`} />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total",   val: total,                                                           color: "#1a1a1a" },
          { label: "Actifs",  val: data.filter(u => u.status === "actif").length,                  color: "#1D9E75" },
          { label: "Bloqués", val: data.filter(u => ["bloque","bloqué"].includes(u.status)).length, color: "#993C1D" },
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
            <SectionHeader title="Liste des utilisateurs" icon={Users} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
                  transform: "translateY(-50%)", color: "#bbb" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{ paddingLeft: 28, paddingRight: 10, height: 32, border: "0.5px solid #eee",
                    borderRadius: 8, fontSize: 12, outline: "none", color: "#333", width: 200 }} />
              </div>
              <button onClick={handleExport} disabled={exporting}
                style={{ display: "flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px",
                  border: "0.5px solid #e4dfd8", borderRadius: 8, background: "white",
                  cursor: "pointer", fontSize: 12, color: "#666" }}>
                <Download size={13} />
                {exporting ? "…" : "CSV"}
              </button>
            </div>
          </div>

          {/* Barre batch */}
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
                    <button onClick={() => batchAction("bloque")} disabled={batching}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none",
                        background: "#dc2626", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Bloquer
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
              Aucun utilisateur trouvé
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
