import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, ShieldOff, ShieldCheck, Download,
  CheckSquare, Square, X, Trash2, ChevronLeft, ChevronRight,
  ArrowUpAZ, ArrowDownAZ, Clock, Pencil, Save,
} from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

// "suspendu" en DB = "bloqué" côté UI
const displayStatus = (s) => (s === "suspendu" ? "bloqué" : s);
const STATUS_BADGE = { actif: "green", bloque: "red", bloqué: "red", suspendu: "red" };
const ROLE_BADGE   = { client: "gray", restaurateur: "blue", admin: "green" };

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
  const [selected,   setSelected]   = useState(new Set());
  const [exporting,  setExporting]  = useState(false);
  const [batching,   setBatching]   = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [editUser,   setEditUser]   = useState(null);  // user en cours d'édition
  const [editForm,   setEditForm]   = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg,    setEditMsg]    = useState("");
  const [mainTab,    setMainTab]    = useState("clients"); // "clients" | "restaurants"
  const [roleFilter, setRoleFilter] = useState("client"); // "" | "client" | "restaurateur" | "admin"

  const LIMIT = 30;
  const totalPages = Math.ceil(total / LIMIT);

  const load = useCallback(() => {
    setLoading(true);
    adminService.listUsers({ search: search || undefined, role: roleFilter || undefined, limit: LIMIT, page, sort })
      .then(res => { setData(res.data || []); setTotal(res.pagination?.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, sort, page]);

  const switchTab = (tab) => {
    setMainTab(tab);
    setRoleFilter(tab === "clients" ? "client" : "restaurateur");
    setSearch("");
    setPage(1);
    setSelected(new Set());
  };

  useEffect(() => { setSelected(new Set()); setPage(1); }, [search, sort, roleFilter]);
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

  const actionCol = (u) => {
    const isBlocked = ["suspendu","bloque","bloqué"].includes(u.status);
    return (
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => { setEditUser(u); setEditForm({ full_name: u.full_name, email: u.email, role: u.role, new_password: "" }); setEditMsg(""); }}
          style={{ padding: "4px 8px", borderRadius: 6, border: "0.5px solid #e4dfd8",
            background: "white", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Pencil size={12} color="#888" />
        </button>
        <Btn onClick={() => toggleBlock(u)} variant={isBlocked ? "default" : "danger"}
          icon={isBlocked ? ShieldCheck : ShieldOff} style={{ fontSize: 11, padding: "4px 10px" }}>
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
  };

  // Colonnes onglet Clients
  const colsClients = [
    { key: "check", label: () => (<button onClick={toggleAll} style={{ background:"none",border:"none",cursor:"pointer",padding:0,display:"flex" }}>{allChecked?<CheckSquare size={15} color="#e8a045"/>:<Square size={15} color="#ccc"/>}</button>),
      render: u => (<button onClick={() => toggleSelect(u.id)} style={{ background:"none",border:"none",cursor:"pointer",padding:0,display:"flex" }}>{selected.has(u.id)?<CheckSquare size={15} color="#e8a045"/>:<Square size={15} color="#ddd"/>}</button>) },
    { key: "name",   label: "Client", render: u => (<div><div style={{ fontWeight:500, fontSize:13 }}>{u.full_name}</div><div style={{ fontSize:11, color:"#aaa" }}>{u.email}</div></div>) },
    { key: "phone",  label: "Téléphone", render: u => <span style={{ fontSize:12, color:"#888" }}>{u.phone||"—"}</span> },
    { key: "reserv", label: "Réservations", align: "center", render: u => <span style={{ fontWeight:500 }}>{u.resa_count||0}</span> },
    { key: "status", label: "Statut", render: u => <Badge label={displayStatus(u.status)} variant={STATUS_BADGE[u.status]||"gray"} /> },
    { key: "joined", label: "Inscrit", render: u => <span style={{ fontSize:11, color:"#bbb" }}>{fmtDate(u.created_at)}</span> },
    { key: "actions", label: "", align: "right", render: u => actionCol(u) },
  ];

  // Colonnes onglet Restaurants
  const colsRestaurants = [
    { key: "check", label: () => (<button onClick={toggleAll} style={{ background:"none",border:"none",cursor:"pointer",padding:0,display:"flex" }}>{allChecked?<CheckSquare size={15} color="#e8a045"/>:<Square size={15} color="#ccc"/>}</button>),
      render: u => (<button onClick={() => toggleSelect(u.id)} style={{ background:"none",border:"none",cursor:"pointer",padding:0,display:"flex" }}>{selected.has(u.id)?<CheckSquare size={15} color="#e8a045"/>:<Square size={15} color="#ddd"/>}</button>) },
    { key: "code", label: "Code accès", render: u => (
      <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"#E8A045",
        background:"#FEF6EC", padding:"2px 8px", borderRadius:6, letterSpacing:"0.5px" }}>
        {u.access_code || "—"}
      </span>
    )},
    { key: "name",   label: "Restaurant", render: u => (<div><div style={{ fontWeight:600, fontSize:13, color:"#1e2e28" }}>{u.resto_name||"—"}</div><div style={{ fontSize:11, color:"#aaa" }}>{u.full_name} · {u.email}</div></div>) },
    { key: "phone",  label: "Téléphone", render: u => <span style={{ fontSize:12, color:"#888" }}>{u.phone||"—"}</span> },
    { key: "status", label: "Statut", render: u => <Badge label={displayStatus(u.status)} variant={STATUS_BADGE[u.status]||"gray"} /> },
    { key: "joined", label: "Inscrit", render: u => <span style={{ fontSize:11, color:"#bbb" }}>{fmtDate(u.created_at)}</span> },
    { key: "actions", label: "", align: "right", render: u => actionCol(u) },
  ];

  const cols = mainTab === "restaurants" ? colsRestaurants : colsClients;

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
          {/* Onglets principaux Clients / Restaurants */}
          <div style={{ display: "flex", borderBottom: "0.5px solid #eee", marginBottom: 14 }}>
            {[
              { key: "clients",      label: "Clients",      icon: "👤" },
              { key: "restaurants",  label: "Restaurants",  icon: "🍽" },
            ].map(tab => (
              <button key={tab.key} onClick={() => switchTab(tab.key)}
                style={{ padding: "10px 20px", fontSize: 13, cursor: "pointer",
                  background: "none", border: "none",
                  borderBottom: `2.5px solid ${mainTab === tab.key ? "#E8A045" : "transparent"}`,
                  color: mainTab === tab.key ? "#E8A045" : "#888",
                  fontWeight: mainTab === tab.key ? 700 : 400,
                  marginBottom: -1, transition: "all .15s" }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
            <SectionHeader title={mainTab === "restaurants" ? "Restaurants partenaires" : "Comptes clients"} icon={Users} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* Sous-filtre admin uniquement sur onglet clients */}
              {mainTab === "clients" && (
              <div style={{ display: "flex", gap: 4 }}>
                {[["client","Clients"],["admin","Admins"]].map(([r, label]) => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                      border: `0.5px solid ${roleFilter === r ? "#E8A045" : "#eee"}`,
                      background: roleFilter === r ? "#fef6ec" : "white",
                      color: roleFilter === r ? "#c47d1a" : "#888",
                      fontWeight: roleFilter === r ? 600 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>
              )}
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

      {/* ── Modal édition utilisateur ── */}
      <AnimatePresence>
        {editUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditUser(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50 }} />
            <div style={{ position: "fixed", inset: 0, zIndex: 60,
              display: "flex", alignItems: "center", justifyContent: "center", padding: 16, pointerEvents: "none" }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                style={{ background: "white", borderRadius: 16, padding: 24,
                  width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,.2)",
                  pointerEvents: "auto" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1e2e28" }}>Modifier l'utilisateur</div>
                    <div style={{ fontSize: 12, color: "#9ba89f", marginTop: 2 }}>{editUser.email}</div>
                  </div>
                  <button onClick={() => setEditUser(null)}
                    style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                    <X size={18} color="#9ba89f" />
                  </button>
                </div>

                {editMsg && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 12,
                    background: editMsg.includes("succès") ? "#e1f5ee" : "#faece7",
                    color: editMsg.includes("succès") ? "#1D9E75" : "#993C1D" }}>
                    {editMsg}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { label: "Nom complet", key: "full_name", type: "text" },
                    { label: "Adresse e-mail", key: "email", type: "email" },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9ba89f",
                        textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>{label}</label>
                      <input value={editForm[key] || ""} onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                        type={type}
                        style={{ width: "100%", border: "0.5px solid #e4dfd8", borderRadius: 8,
                          padding: "10px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
                          background: "#f8f5ef" }} />
                    </div>
                  ))}

                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9ba89f",
                      textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Rôle</label>
                    <select value={editForm.role || ""} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                      style={{ width: "100%", border: "0.5px solid #e4dfd8", borderRadius: 8,
                        padding: "10px 12px", fontSize: 13, outline: "none", background: "#f8f5ef",
                        cursor: "pointer" }}>
                      <option value="client">Client</option>
                      <option value="restaurateur">Restaurateur</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9ba89f",
                      textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
                      Nouveau mot de passe (laisser vide pour ne pas changer)
                    </label>
                    <input value={editForm.new_password || ""} onChange={e => setEditForm(p => ({ ...p, new_password: e.target.value }))}
                      type="password" placeholder="••••••••"
                      style={{ width: "100%", border: "0.5px solid #e4dfd8", borderRadius: 8,
                        padding: "10px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
                        background: "#f8f5ef" }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button onClick={() => setEditUser(null)}
                    style={{ flex: 1, border: "0.5px solid #eee", borderRadius: 9, padding: "11px 0",
                      background: "white", cursor: "pointer", fontSize: 13, color: "#888" }}>
                    Annuler
                  </button>
                  <button onClick={async () => {
                      setEditSaving(true); setEditMsg("");
                      try {
                        await adminService.updateUser(editUser.id, {
                          full_name:    editForm.full_name,
                          email:        editForm.email,
                          role:         editForm.role,
                          new_password: editForm.new_password || undefined,
                        });
                        setData(prev => prev.map(u => u.id === editUser.id
                          ? { ...u, full_name: editForm.full_name, email: editForm.email, role: editForm.role }
                          : u
                        ));
                        setEditMsg("Modifications enregistrées avec succès !");
                        setTimeout(() => setEditUser(null), 1500);
                      } catch (e) {
                        setEditMsg(e.response?.data?.message || "Erreur lors de la mise à jour");
                      }
                      setEditSaving(false);
                    }}
                    disabled={editSaving}
                    style={{ flex: 2, border: "none", borderRadius: 9, padding: "11px 0",
                      background: "#e8a045", color: "#1A1000", fontSize: 13, fontWeight: 700,
                      cursor: editSaving ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Save size={14} /> {editSaving ? "Sauvegarde…" : "Enregistrer"}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
