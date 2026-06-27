import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck, CheckCircle, XCircle, AlertTriangle,
  Clock, Users, MessageCircle, X, Plus,
} from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn, Table } from "../../components/ui";
import { reservationsService } from "../../services/reservations.service.js";
import { chatService } from "../../services/chat.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Chat from "../../components/Chat.jsx";

const G = "#1D9E75";

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
  const [mainTab,   setMainTab]   = useState("reservations"); // reservations | analytics | noshow | waitlist | chat
  const [waitlist,  setWaitlist]  = useState([]);
  const [chatRes,   setChatRes]   = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showAddWait, setShowAddWait] = useState(false);
  const [newWait,   setNewWait]   = useState({ name: "", phone: "", party: 2 });

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

  const confirm = async (id) => {
    try {
      await reservationsService.confirm(id);
      setData(prev => prev.map(r => r.id === id ? { ...r, status: "confirme" } : r));
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

  const filtered = filter === "tous"
    ? data
    : data.filter(r => r.status === filter || r.status === filter.replace(/_/g," "));

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
    { key: "montant", label: "Arrhes", align: "right",  render: r => <span style={{ fontWeight: 500 }}>{fmt(r.arrhes_amount)}</span> },
    { key: "status",  label: "Statut", render: r => <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} /> },
    { key: "actions", label: "",       align: "right", render: r => {
      const pending = ["en_attente","en attente"].includes(r.status);
      const confirmed = ["confirme","confirmé"].includes(r.status);
      return (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {pending && <>
            <Btn onClick={() => confirm(r.id)} variant="primary" icon={CheckCircle} style={{ fontSize: 10, padding: "2px 7px" }}>OK</Btn>
            <Btn onClick={() => cancel(r.id)} variant="danger" icon={XCircle} style={{ fontSize: 10, padding: "2px 7px" }}>Non</Btn>
          </>}
          {confirmed && !r.is_noshow && (
            <Btn onClick={() => markNoShow(r.id)} variant="default" style={{ fontSize: 10, padding: "2px 7px", color: "#DC2626" }}>No-show</Btn>
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
        <PageTitle title="Réservations" subtitle="Gestion complète des réservations" />
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
    </motion.div>
  );
}
