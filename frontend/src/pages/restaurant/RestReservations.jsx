import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck, CheckCircle, XCircle, AlertTriangle,
  Clock, Users, MessageCircle, X, Plus, LayoutTemplate,
} from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table, DateFilter, Modal, FormField, Input, Select } from "../../components/ui";
import { reservationsService } from "../../services/reservations.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";
import { chatService } from "../../services/chat.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Chat from "../../components/Chat.jsx";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";
const G      = P; // alias backward-compat

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const STATUS_BADGE = {
  confirme: "green", en_attente: "amber", annule: "red",
  confirmé: "green", "en attente": "amber", annulé: "red",
};

const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "—";
const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
  : "—";
const fmtDateShort = (dt) => dt
  ? new Date(dt).toLocaleDateString("fr-FR", { day:"2-digit", month:"short" })
  : "—";

// ── Barre de chart CSS ───────────────────────────────────────────────────────
function BarChart({ data, color = G }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: "100%", background: color + "22", borderRadius: "3px 3px 0 0",
            position: "relative", height: 60 }}>
            <motion.div
              initial={{ height: 0 }} animate={{ height: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                background: color, borderRadius: "3px 3px 0 0" }} />
          </div>
          <span style={{ fontSize: 9, color: "#bbb", textAlign: "center" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Génère stats horaires fictives (à remplacer par API) ────────────────────
function buildHourStats(reservations) {
  const hours = Array.from({ length: 14 }, (_, i) => ({
    label: `${i + 10}h`,
    value: 0,
  }));
  reservations.forEach(r => {
    if (!r.reserved_at) return;
    const h = new Date(r.reserved_at).getHours();
    const idx = h - 10;
    if (idx >= 0 && idx < 14) hours[idx].value++;
  });
  return hours;
}

function buildDayStats(reservations) {
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(l => ({ label: l, value: 0 }));
  reservations.forEach(r => {
    if (!r.reserved_at) return;
    const d = new Date(r.reserved_at).getDay();
    const idx = d === 0 ? 6 : d - 1;
    days[idx].value++;
  });
  return days;
}

export default function RestReservations() {
  const { user } = useAuth();
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("tous");
  const [dateMode,  setDateMode]  = useState("Mois"); // "Jour" | "Mois" | "Année"
  const [mainTab,   setMainTab]   = useState("reservations");
  const [modalCreate, setModalCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    client_name: "", client_phone: "", client_email: "",
    reserved_at: new Date().toISOString().slice(0,16),
    party_size: 2, notes: "",
  });
  const [waitlist,  setWaitlist]  = useState([]);
  const [chatRes,   setChatRes]   = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showAddWait, setShowAddWait] = useState(false);
  const [newWait,   setNewWait]   = useState({ name: "", phone: "", party: 2 });
  // Modale assignation de table
  const [confirmModal, setConfirmModal] = useState(null); // { resa }
  const [tables,       setTables]       = useState([]);   // tables libres du resto
  const [selectedTable, setSelectedTable] = useState("");
  const [loadingTables, setLoadingTables] = useState(false);
  // Modale changement de table (résa déjà confirmée)
  const [assignModal, setAssignModal] = useState(null); // { resa }

  // Charger les tables libres + réservées du resto
  const loadTables = async () => {
    if (!user?.resto_id) return;
    setLoadingTables(true);
    try {
      const d = await restaurantsService.getManage(user.resto_id);
      const ts = (d.restaurant?.tables || []).filter(t =>
        ["libre","free","reserve","réservé","reserved"].includes(t.status)
      );
      setTables(ts);
    } catch (_) {}
    setLoadingTables(false);
  };

  useEffect(() => {
    reservationsService.list({ limit: 100 })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));

    chatService.getConversations()
      .then(setConversations)
      .catch(() => {});

    // Charger liste d'attente depuis localStorage (backend optionnel)
    try {
      setWaitlist(JSON.parse(localStorage.getItem("tci_waitlist") || "[]"));
    } catch { setWaitlist([]); }
  }, []);

  // Ouvre la modale de confirmation avec sélection de table
  const openConfirmModal = (resa) => {
    setConfirmModal(resa);
    setSelectedTable(resa.table_id || "");
    loadTables();
  };

  const confirmWithTable = async () => {
    if (!confirmModal) return;
    try {
      await reservationsService.confirm(confirmModal.id, selectedTable || null);
      setData(prev => prev.map(r => r.id === confirmModal.id
        ? { ...r, status: "confirme", table_id: selectedTable || r.table_id,
            table_label: tables.find(t => t.id === selectedTable)?.label || r.table_label }
        : r
      ));
      setConfirmModal(null);
      setSelectedTable("");
    } catch (e) { console.error(e); }
  };

  // Ouvre la modale pour changer/assigner une table à une résa déjà confirmée
  const openAssignModal = (resa) => {
    setAssignModal(resa);
    setSelectedTable(resa.table_id || "");
    loadTables();
  };

  const assignTable = async () => {
    if (!assignModal || !selectedTable) return;
    try {
      await reservationsService.assignTable(assignModal.id, selectedTable);
      const tbl = tables.find(t => t.id === selectedTable);
      setData(prev => prev.map(r => r.id === assignModal.id
        ? { ...r, table_id: selectedTable, table_label: tbl?.label || r.table_label }
        : r
      ));
      setAssignModal(null);
      setSelectedTable("");
    } catch (e) { console.error(e); }
  };

  const cancel = async (id) => {
    try {
      await reservationsService.cancel(id, "Annulé par le restaurateur");
      setData(prev => prev.map(r => r.id === id ? { ...r, status: "annule" } : r));
    } catch (e) { console.error(e); }
  };

  const markNoShow = (id) => {
    setData(prev => prev.map(r => r.id === id ? { ...r, is_noshow: true, status: "annule" } : r));
  };

  // Créer une réservation depuis l'interface restaurateur
  const createReservation = async () => {
    try {
      const payload = {
        ...createForm,
        party_size: Number(createForm.party_size),
        source: "restaurateur",
      };
      const res = await reservationsService.create(payload).catch(() => null);
      const newR = res?.reservation || {
        id: Date.now(), ...payload,
        status: "confirme", ref: "R-" + Math.random().toString(36).slice(2,7).toUpperCase(),
      };
      setData(prev => [newR, ...prev]);
    } catch (e) { console.error(e); }
    setModalCreate(false);
    setCreateForm({ client_name:"", client_phone:"", client_email:"",
      reserved_at: new Date().toISOString().slice(0,16), party_size: 2, notes: "" });
  };

  // Modifier une réservation en ligne
  const updateReservation = async (id, fields) => {
    try {
      await reservationsService.update(id, fields).catch(() => null);
      setData(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    } catch (e) { console.error(e); }
  };

  // Filtrage par mode date
  const filterByDate = (items) => {
    const now = new Date();
    return items.filter(r => {
      if (!r.reserved_at) return true;
      const d = new Date(r.reserved_at);
      if (dateMode === "Jour")  return d.toDateString() === now.toDateString();
      if (dateMode === "Mois")  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (dateMode === "Année") return d.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const addWaitlist = () => {
    if (!newWait.name) return;
    const entry = {
      id: Date.now(), ...newWait,
      created_at: new Date().toISOString(), status: "waiting",
    };
    const updated = [entry, ...waitlist];
    setWaitlist(updated);
    localStorage.setItem("tci_waitlist", JSON.stringify(updated));
    setNewWait({ name: "", phone: "", party: 2 });
    setShowAddWait(false);
  };

  const notifyWaitlist = (id) => {
    const updated = waitlist.map(w => w.id === id ? { ...w, status: "notified", notified_at: new Date().toISOString() } : w);
    setWaitlist(updated);
    localStorage.setItem("tci_waitlist", JSON.stringify(updated));
    const w = waitlist.find(x => x.id === id);
    if (w?.phone) {
      const msg = encodeURIComponent(`🍽️ Une table se libère chez votre restaurant ! Cliquez ici pour confirmer votre réservation : tabliere.vercel.app`);
      window.open(`https://wa.me/${w.phone.replace(/\D/g,"")}?text=${msg}`, "_blank");
    }
  };

  const removeWaitlist = (id) => {
    const updated = waitlist.filter(w => w.id !== id);
    setWaitlist(updated);
    localStorage.setItem("tci_waitlist", JSON.stringify(updated));
  };

  const filteredByDate = filterByDate(data);
  const filtered = filter === "tous"
    ? filteredByDate
    : filteredByDate.filter(r => r.status === filter || r.status === filter.replace(/_/g," "));

  // No-show : clients avec 2+ annulations
  const clientCancels = {};
  data.forEach(r => {
    if (["annule","annulé"].includes(r.status) || r.is_noshow) {
      const key = r.client_name || r.user_id;
      if (key) clientCancels[key] = (clientCancels[key] || 0) + 1;
    }
  });
  const noShowClients = Object.entries(clientCancels)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);

  const hourStats = buildHourStats(data);
  const dayStats  = buildDayStats(data);
  const avgParty  = data.length
    ? (data.reduce((a, r) => a + (r.party_size || 0), 0) / data.length).toFixed(1)
    : 0;

  const TABS_TOP = [
    { id: "reservations", label: "Réservations", icon: CalendarCheck },
    { id: "analytics",    label: "Analytics",    icon: Clock },
    { id: "waitlist",     label: `Liste d'attente${waitlist.filter(w=>w.status==="waiting").length>0?" ("+waitlist.filter(w=>w.status==="waiting").length+")":""}`, icon: Users },
    { id: "noshow",       label: "No-show",      icon: AlertTriangle },
    { id: "chat",         label: `Messages${conversations.reduce((a,c)=>a+(parseInt(c.unread_count)||0),0)>0?" ●":""}`, icon: MessageCircle },
  ];

  const cols = [
    { key: "ref",     label: "Réf",    render: r => <span style={{ fontFamily: "monospace", fontSize: 11, color: "#aaa" }}>{r.ref}</span> },
    { key: "client",  label: "Client", render: r => (
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.client_name || "—"}</div>
        {r.is_noshow && <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 600 }}>⚠ No-show</span>}
      </div>
    )},
    { key: "date",    label: "Date",   render: r => <span style={{ fontSize: 12 }}>{fmtDate(r.reserved_at)}</span> },
    { key: "pers",    label: "Pers.",  align: "center", render: r => r.party_size },
    { key: "table",   label: "Table",  align: "center", render: r => {
      const confirmed = ["confirme","confirmé"].includes(r.status);
      return r.table_label ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
          <span style={{ fontWeight: 600, color: G, fontSize: 13 }}>{r.table_label}</span>
          {confirmed && (
            <button onClick={() => openAssignModal(r)}
              style={{ border: "none", background: "transparent", cursor: "pointer",
                color: "#bbb", fontSize: 10, padding: 0, lineHeight: 1 }}
              title="Changer de table">✎</button>
          )}
        </div>
      ) : (
        confirmed ? (
          <button onClick={() => openAssignModal(r)}
            style={{ border: `0.5px dashed ${G}`, borderRadius: 6, padding: "2px 7px",
              background: "#E1F5EE", color: G, cursor: "pointer", fontSize: 11 }}>
            + Table
          </button>
        ) : <span style={{ color: "#ccc", fontSize: 11 }}>—</span>
      );
    }},
    { key: "montant", label: "Arrhes", align: "right",  render: r => <span style={{ fontWeight: 500 }}>{fmt(r.arrhes_amount)}</span> },
    { key: "status",  label: "Statut", render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /> },
    { key: "actions", label: "",       align: "right", render: r => {
      const pending   = ["en_attente","en attente"].includes(r.status);
      const confirmed = ["confirme","confirmé"].includes(r.status);
      return (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {pending && <>
            <Btn onClick={() => openConfirmModal(r)} variant="primary" icon={CheckCircle}
              style={{ fontSize: 10, padding: "2px 7px" }}>Confirmer</Btn>
            <Btn onClick={() => cancel(r.id)} variant="danger" icon={XCircle}
              style={{ fontSize: 10, padding: "2px 7px" }}>Refuser</Btn>
          </>}
          {confirmed && !r.is_noshow && (
            <Btn onClick={() => markNoShow(r.id)} variant="default"
              style={{ fontSize: 10, padding: "2px 7px", color: "#DC2626" }}>No-show</Btn>
          )}
          {r.id && (
            <Btn onClick={() => { setChatRes({ id: r.id, name: r.client_name }); setMainTab("chat"); }}
              style={{ fontSize: 10, padding: "2px 7px" }}>
              <MessageCircle size={10} /> Chat
            </Btn>
          )}
        </div>
      );
    }},
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <PageTitle title="Réservations" subtitle="Gestion complète des réservations" />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <DateFilter value={dateMode} onChange={setDateMode} />
            <Btn variant="primary" icon={Plus} onClick={() => setModalCreate(true)}>
              Nouvelle réservation
            </Btn>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Total",      val: data.length,                                                              color: "#1a1a1a" },
          { label: "Confirmées", val: data.filter(r => ["confirme","confirmé"].includes(r.status)).length,      color: G },
          { label: "En attente", val: data.filter(r => ["en_attente","en attente"].includes(r.status)).length,  color: "#854F0B" },
          { label: "Annulées",   val: data.filter(r => ["annule","annulé"].includes(r.status)).length,          color: "#993C1D" },
          { label: "Moy. pers.", val: avgParty,                                                                  color: "#185FA5" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 100, background: "white", border: "0.5px solid #eee",
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#888" }}>{s.label}</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </motion.div>

      {/* Tabs internes */}
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", gap: 0, marginBottom: 14, background: "white",
          borderRadius: 10, border: "0.5px solid #eee", overflow: "hidden", overflowX: "auto" }}>
          {TABS_TOP.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setMainTab(id)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 16px",
                border: "none", borderRight: "0.5px solid #f0f0f0",
                background: mainTab === id ? "#E1F5EE" : "white",
                color: mainTab === id ? G : "#666", fontSize: 12,
                fontWeight: mainTab === id ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── RÉSERVATIONS ───────────────────────────────────────────────── */}
      {mainTab === "reservations" && (
        <motion.div variants={fadeUp}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <SectionHeader title="Liste" icon={CalendarCheck} />
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {["tous","confirme","en_attente","annule"].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, cursor: "pointer",
                      border: "0.5px solid", borderColor: filter === f ? G : "#eee",
                      background: filter === f ? "#E1F5EE" : "white",
                      color: filter === f ? G : "#666" }}>
                    {f.replace("_"," ")}
                  </button>
                ))}
              </div>
            </div>
            {loading
              ? <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>Chargement…</div>
              : <Table columns={cols} rows={filtered} />
            }
          </Card>
        </motion.div>
      )}

      {/* ── ANALYTICS ──────────────────────────────────────────────────── */}
      {mainTab === "analytics" && (
        <motion.div variants={fadeUp}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card>
              <SectionHeader title="Heures de pointe" icon={Clock} />
              <BarChart data={hourStats} color={G} />
              <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", marginTop: 6 }}>
                Heure du jour (nombre de réservations)
              </div>
            </Card>
            <Card>
              <SectionHeader title="Jours de la semaine" icon={CalendarCheck} />
              <BarChart data={dayStats} color="#185FA5" />
              <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", marginTop: 6 }}>
                Jour (nombre de réservations)
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 14 }}>
            <Card>
              <SectionHeader title="Aperçu mensuel" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 8 }}>
                {[
                  { label: "Réservations ce mois", val: data.filter(r => {
                      const d = new Date(r.created_at);
                      const now = new Date();
                      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    }).length, color: G },
                  { label: "Taux de confirmation", val: data.length
                      ? Math.round(data.filter(r=>["confirme","confirmé"].includes(r.status)).length/data.length*100)+"%"
                      : "—", color: "#185FA5" },
                  { label: "Revenus (arrhes)", val: data.reduce((a,r)=>a+(parseFloat(r.arrhes_amount)||0),0).toLocaleString("fr-FR")+" F", color: "#854F0B" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "#f8f8f8", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ── LISTE D'ATTENTE ─────────────────────────────────────────────── */}
      {mainTab === "waitlist" && (
        <motion.div variants={fadeUp}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <SectionHeader title="Liste d'attente" icon={Users} />
              <Btn onClick={() => setShowAddWait(true)} variant="primary" icon={Plus}
                style={{ fontSize: 12, padding: "5px 12px" }}>
                Ajouter
              </Btn>
            </div>

            <AnimatePresence>
              {showAddWait && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ background: "#f8f8f8", borderRadius: 10, padding: 14, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Nom</label>
                      <input value={newWait.name} onChange={e => setNewWait(p=>({...p,name:e.target.value}))}
                        placeholder="Client" style={{ width: "100%", border: "0.5px solid #ddd",
                          borderRadius: 7, padding: "7px 10px", fontSize: 12, outline: "none" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>WhatsApp</label>
                      <input value={newWait.phone} onChange={e => setNewWait(p=>({...p,phone:e.target.value}))}
                        placeholder="+225..." style={{ width: "100%", border: "0.5px solid #ddd",
                          borderRadius: 7, padding: "7px 10px", fontSize: 12, outline: "none" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Pers.</label>
                      <input type="number" min={1} max={20} value={newWait.party}
                        onChange={e => setNewWait(p=>({...p,party:parseInt(e.target.value)||2}))}
                        style={{ width: 60, border: "0.5px solid #ddd", borderRadius: 7,
                          padding: "7px 10px", fontSize: 12, outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn onClick={addWaitlist} variant="primary" style={{ fontSize: 12, padding: "7px 12px" }}>
                        Ajouter
                      </Btn>
                      <button onClick={() => setShowAddWait(false)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#bbb" }}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {waitlist.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
                Aucun client en attente
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {waitlist.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", background: w.status==="notified" ? "#FAEEDA" : "#fafafa",
                    borderRadius: 10, border: "0.5px solid #eee" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E1F5EE",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Users size={14} color={G} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        {w.party} pers. · {w.phone || "Pas de téléphone"}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "#bbb" }}>
                      {new Date(w.created_at).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" })}
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      {w.status === "waiting" && (
                        <Btn onClick={() => notifyWaitlist(w.id)} variant="primary"
                          style={{ fontSize: 11, padding: "3px 9px" }}>
                          Notifier WhatsApp
                        </Btn>
                      )}
                      {w.status === "notified" && (
                        <span style={{ fontSize: 11, color: "#854F0B", fontWeight: 500 }}>Notifié ✓</span>
                      )}
                      <button onClick={() => removeWaitlist(w.id)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ccc" }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── NO-SHOW ────────────────────────────────────────────────────── */}
      {mainTab === "noshow" && (
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title="Clients à risque (2+ annulations)" icon={AlertTriangle} />
            <div style={{ marginTop: 12 }}>
              {noShowClients.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
                  ✓ Aucun client à risque détecté
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {noShowClients.map(([name, count], i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center",
                      padding: "10px 12px", background: count >= 3 ? "#FAECE7" : "#FAEEDA",
                      borderRadius: 10, border: `0.5px solid ${count >= 3 ? "#FECACA" : "#F5D5A0"}` }}>
                      <AlertTriangle size={14} color={count >= 3 ? "#DC2626" : "#854F0B"}
                        style={{ marginRight: 10, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                        <div style={{ fontSize: 11, color: count >= 3 ? "#DC2626" : "#854F0B" }}>
                          {count} annulation{count > 1 ? "s" : ""} ou no-show
                        </div>
                      </div>
                      <span style={{ fontSize: 20, fontWeight: 700,
                        color: count >= 3 ? "#DC2626" : "#854F0B" }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: 14, padding: "10px 12px", background: "#f8f8f8",
              borderRadius: 8, fontSize: 12, color: "#888" }}>
              💡 Les clients avec 3+ annulations peuvent être marqués comme "bloqués" dans la prochaine version.
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── MODALE CONFIRMATION + SÉLECTION TABLE ──────────────────────── */}
      <AnimatePresence>
        {(confirmModal || assignModal) && (() => {
          const modal = confirmModal || assignModal;
          const isConfirm = !!confirmModal;
          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => { setConfirmModal(null); setAssignModal(null); }}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 50 }} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                style={{ position: "fixed", top: "50%", left: "50%",
                  transform: "translate(-50%,-50%)", zIndex: 60,
                  background: "white", borderRadius: 16, padding: 24,
                  width: "min(460px, 92vw)", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {isConfirm ? "Confirmer la réservation" : "Assigner une table"}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                      {modal.client_name} · {modal.party_size} pers. · {fmtDate(modal.reserved_at)}
                    </div>
                  </div>
                  <button onClick={() => { setConfirmModal(null); setAssignModal(null); }}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#bbb" }}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 8 }}>
                    <LayoutTemplate size={13} style={{ verticalAlign: "middle", marginRight: 4, color: G }} />
                    Choisir une table {isConfirm && "(optionnel)"}
                  </label>

                  {loadingTables ? (
                    <div style={{ fontSize: 12, color: "#bbb", padding: "10px 0" }}>Chargement des tables…</div>
                  ) : tables.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#bbb", padding: "10px 0" }}>
                      Aucune table disponible. Configurez vos tables dans Plan de salle.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {isConfirm && (
                        <button onClick={() => setSelectedTable("")}
                          style={{ border: `1.5px solid ${!selectedTable ? "#ccc" : "#eee"}`,
                            borderRadius: 9, padding: "10px 6px", cursor: "pointer", textAlign: "center",
                            background: !selectedTable ? "#f8f8f8" : "white",
                            color: !selectedTable ? "#888" : "#ccc", fontSize: 12 }}>
                          Sans table
                        </button>
                      )}
                      {tables.map(t => {
                        const isFree = ["libre","free"].includes(t.status);
                        const isSelected = selectedTable === t.id;
                        return (
                          <button key={t.id} onClick={() => setSelectedTable(t.id)}
                            disabled={!isFree && !isSelected}
                            style={{ border: `1.5px solid ${isSelected ? G : isFree ? "#eee" : "#fecaca"}`,
                              borderRadius: 9, padding: "10px 6px", cursor: isFree ? "pointer" : "not-allowed",
                              textAlign: "center", background: isSelected ? "#E1F5EE" : isFree ? "white" : "#fef2f2",
                              opacity: !isFree && !isSelected ? 0.5 : 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14,
                              color: isSelected ? G : isFree ? "#1a1a1a" : "#DC2626" }}>
                              {t.label}
                            </div>
                            <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                              {t.capacity}p · {isFree ? "Libre" : "Occupée"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setConfirmModal(null); setAssignModal(null); }}
                    style={{ flex: 1, border: "0.5px solid #eee", borderRadius: 9, padding: "11px 0",
                      background: "white", cursor: "pointer", fontSize: 13, color: "#666" }}>
                    Annuler
                  </button>
                  <button onClick={isConfirm ? confirmWithTable : assignTable}
                    disabled={!isConfirm && !selectedTable}
                    style={{ flex: 2, border: "none", borderRadius: 9, padding: "11px 0",
                      background: (!isConfirm && !selectedTable) ? "#a0cfbe" : G,
                      color: "white", cursor: (!isConfirm && !selectedTable) ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: 600 }}>
                    {isConfirm
                      ? selectedTable ? "✓ Confirmer et assigner" : "✓ Confirmer sans table"
                      : "Assigner la table"
                    }
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── CHAT ───────────────────────────────────────────────────────── */}
      {mainTab === "chat" && (
        <motion.div variants={fadeUp}>
          {chatRes ? (
            <div style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
              <button onClick={() => setChatRes(null)}
                style={{ display: "flex", alignItems: "center", gap: 5, border: "none",
                  background: "transparent", cursor: "pointer", color: "#888", fontSize: 12, marginBottom: 10 }}>
                ← Toutes les conversations
              </button>
              <Chat reservationId={chatRes.id} otherName={chatRes.name} onClose={() => setChatRes(null)} />
            </div>
          ) : (
            <Card>
              <SectionHeader title="Messages clients" icon={MessageCircle} />
              <div style={{ marginTop: 12 }}>
                {conversations.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
                    Aucun message pour l'instant.<br />
                    <span style={{ fontSize: 12 }}>Les clients peuvent vous écrire depuis leur profil.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {conversations.map((c, i) => (
                      <motion.div key={i} whileHover={{ x: 2 }}
                        onClick={() => setChatRes({ id: c.reservation_id, name: c.client_name })}
                        style={{ display: "flex", alignItems: "center", gap: 10,
                          padding: "11px 12px", background: "#fafafa", borderRadius: 10,
                          border: "0.5px solid #eee", cursor: "pointer" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#E1F5EE",
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MessageCircle size={16} color={G} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.client_name || "Client"}</div>
                          <div style={{ fontSize: 12, color: "#999",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.last_message || "Nouvelle conversation"}
                          </div>
                        </div>
                        {parseInt(c.unread_count) > 0 && (
                          <span style={{ background: "#DC2626", color: "white",
                            borderRadius: "50%", width: 20, height: 20, fontSize: 10,
                            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                            {c.unread_count}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {/* ── Modal : Créer une réservation ─────────────────────────────────── */}
      {modalCreate && (
        <Modal open title="Nouvelle réservation" onClose={() => setModalCreate(false)} width={520}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Nom du client">
              <Input value={createForm.client_name}
                onChange={e => setCreateForm(p => ({ ...p, client_name: e.target.value }))}
                placeholder="Jean Kouassi" />
            </FormField>
            <FormField label="Téléphone">
              <Input value={createForm.client_phone}
                onChange={e => setCreateForm(p => ({ ...p, client_phone: e.target.value }))}
                placeholder="+225 07 00 00 00 00" />
            </FormField>
          </div>
          <FormField label="Email (optionnel)">
            <Input value={createForm.client_email} type="email"
              onChange={e => setCreateForm(p => ({ ...p, client_email: e.target.value }))}
              placeholder="client@exemple.com" />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Date & heure">
              <Input value={createForm.reserved_at} type="datetime-local"
                onChange={e => setCreateForm(p => ({ ...p, reserved_at: e.target.value }))} />
            </FormField>
            <FormField label="Nombre de personnes">
              <Input value={createForm.party_size} type="number"
                onChange={e => setCreateForm(p => ({ ...p, party_size: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Notes (optionnel)">
            <textarea value={createForm.notes}
              onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Anniversaire, allergie, demande spéciale…" rows={2}
              style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
                padding: "9px 12px", fontSize: 13, color: DARK, background: BG,
                outline: "none", fontFamily: FONT, resize: "vertical", boxSizing: "border-box" }} />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => setModalCreate(false)}>Annuler</Btn>
            <Btn variant="primary" onClick={createReservation}
              disabled={!createForm.client_name || !createForm.reserved_at}>
              Créer la réservation
            </Btn>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}
