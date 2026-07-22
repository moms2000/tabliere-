import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, TrendingUp, BarChart3, CheckCircle,
  Clock, X, RefreshCw, Award, AlertTriangle, Plus, Minus, Pencil,
} from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn } from "../../components/ui";
import { ordersService }     from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";
import { menuService }        from "../../services/menu.service.js";
import { useAuth }           from "../../context/AuthContext.jsx";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "—";
const fmtDate = (dt) => dt
  ? new Date(dt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
  : "—";

const STATUS_COLORS = {
  en_attente: { bg: "#FEF3C7", color: "#92400E", label: "En attente" },
  en_cours:   { bg: "#DBEAFE", color: "#1E40AF", label: "En cours" },
  servi:      { bg: "#D1FAE5", color: "#065F46", label: "Servi" },
  annule:     { bg: "#FEE2E2", color: "#991B1B", label: "Annulé" },
};

const PERIODS = [
  { key: "day",   label: "Aujourd'hui" },
  { key: "week",  label: "7 jours" },
  { key: "month", label: "30 jours" },
  { key: "year",  label: "Année" },
];

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: BG, color: MUTED, label: status };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px",
      borderRadius: 6, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// Imprimante integree Sunmi (disponible seulement dans l'app sur les terminaux Sunmi)
function getSunmiPrinter() {
  const cap = typeof window !== "undefined" ? window.Capacitor : null;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.SunmiPrinter) {
    return cap.Plugins.SunmiPrinter;
  }
  return null;
}

function PrintReceipt({ order, restoName }) {
  const printSunmi = async (printer) => {
    await printer.printReceipt({
      restoName: restoName || "Restaurant",
      tableLabel: order.table_label || "",
      dateText: fmtDate(order.created_at),
      items: (order.items || []).map(it => ({
        left:  `${it.qty}x ${it.name}${it.options_label ? "\n   " + it.options_label : ""}`,
        right: it.price ? Number(it.price * it.qty).toLocaleString("fr-FR") + " F" : "",
      })),
      totalText: order.total ? Number(order.total).toLocaleString("fr-FR") + " F" : "",
      footer: "Merci pour votre visite",
    });
  };

  const print = async () => {
    const printer = getSunmiPrinter();
    if (printer) {
      try {
        await printSunmi(printer);
        return;
      } catch (e) {
        const msg = String(e?.message || e || "");
        if (msg.includes("PRINTER_NOT_READY")) {
          alert("Imprimante non détectée. Patiente un instant et réessaie.");
          return;
        }
        alert("Impression impossible sur cet appareil.");
        return;
      }
    }
    // Ordinateur : impression via le navigateur
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) { alert("Autorise les fenêtres pour imprimer."); return; }
    w.document.write(`
      <html><head><title>Reçu</title>
      <style>
        body { font-family: monospace; font-size: 13px; padding: 20px; max-width: 300px; margin: 0 auto; }
        h2 { text-align: center; font-size: 16px; }
        hr { border: none; border-top: 1px dashed #ccc; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .total { font-size: 15px; font-weight: bold; }
        .center { text-align: center; }
      </style></head>
      <body>
        <h2>${restoName || "Restaurant"}</h2>
        <p class="center" style="font-size:11px;color:#666;">TablièreCI</p>
        <hr />
        <p class="center"><strong>Table : ${order.table_label || "—"}</strong></p>
        <p class="center" style="font-size:11px;">${fmtDate(order.created_at)}</p>
        <hr />
        ${(order.items || []).map(it => `
          <div class="row">
            <span>${it.qty}× ${it.name}${it.options_label ? ` <em style="color:#888;font-style:normal;">(${it.options_label})</em>` : ""}</span>
            <span>${it.price ? Number(it.price * it.qty).toLocaleString("fr-FR") + " F" : ""}</span>
          </div>`).join("")}
        <hr />
        <div class="row total">
          <span>TOTAL</span>
          <span>${order.total ? Number(order.total).toLocaleString("fr-FR") + " F" : "—"}</span>
        </div>
        <hr />
        <p class="center" style="font-size:11px;margin-top:12px;">Merci pour votre visite !</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };
  return (
    <button onClick={print}
      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7,
        border: `0.5px solid ${BORDER}`, background: "white",
        color: MUTED, cursor: "pointer", fontFamily: FONT }}>
      Imprimer
    </button>
  );
}

export default function RestCommandes() {
  const { user } = useAuth();
  const [orders,       setOrders]       = useState([]);
  const [stats,        setStats]        = useState(null);
  const [restoName,    setRestoName]    = useState("");
  const [restoSlug,    setRestoSlug]    = useState("");
  const [tables,       setTables]       = useState([]);
  const [menuCats,     setMenuCats]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [qrActive,     setQrActive]     = useState(true);
  const [period,       setPeriod]       = useState("day");
  const [activeTab,    setActiveTab]    = useState("commandes");
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshing,   setRefreshing]   = useState(false);
  // Modale prise de commande manuelle
  const [showManual,   setShowManual]   = useState(false);
  const [manualForm,   setManualForm]   = useState({ client_name: "", client_phone: "", table_label: "", note: "" });
  const [manualCart,   setManualCart]   = useState({}); // {itemId: {item, qty}}
  const [manualErr,    setManualErr]    = useState("");
  const [submittingM,  setSubmittingM]  = useState(false);
  // Modale modification d'une commande
  const [editOrder,    setEditOrder]    = useState(null);
  const [editCart,     setEditCart]     = useState({});
  const [editNote,     setEditNote]     = useState("");

  const load = useCallback(async () => {
    if (!user?.resto_id) return;
    try {
      const [restoData, ordersData, statsData] = await Promise.all([
        restaurantsService.getManage(user.resto_id),
        ordersService.list({ limit: 100, ...(statusFilter ? { status: statusFilter } : {}) }),
        ordersService.getStats({ period }).catch(() => null),
      ]);
      const r = restoData.restaurant || {};
      setRestoName(r.name || "");
      setRestoSlug(r.slug || user.resto_slug || "");
      setQrActive(r.qr_active || false);
      setTables(r.tables || []);
      setOrders(ordersData.data || []);
      if (statsData) setStats(statsData);
      // Charger le menu pour la prise de commande
      if (r.slug || user.resto_slug) {
        menuService.getFullMenu(r.slug || user.resto_slug)
          .then(d => setMenuCats(d.categories || []))
          .catch(() => {});
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.resto_id, user?.resto_slug, period, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); };

  const updateStatus = async (id, status) => {
    try {
      await ordersService.updateStatus(id, status);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    } catch (e) { console.error(e); }
  };

  // ── Commande manuelle ──
  const manualItems = Object.values(manualCart);
  const manualTotal = manualItems.reduce((s, { item, qty }) => s + item.price * qty, 0);

  const addToManual = (item) =>
    setManualCart(p => ({ ...p, [item.id]: { item, qty: (p[item.id]?.qty || 0) + 1 } }));
  const remFromManual = (id) =>
    setManualCart(p => {
      const qty = (p[id]?.qty || 0) - 1;
      if (qty <= 0) { const n = { ...p }; delete n[id]; return n; }
      return { ...p, [id]: { ...p[id], qty } };
    });

  const submitManual = async () => {
    if (manualItems.length === 0) return;
    setManualErr(""); setSubmittingM(true);
    try {
      const items = manualItems.map(({ item, qty }) => ({
        id: item.id, name: item.name, price: item.price, qty,
      }));
      const result = await ordersService.createManual({
        table_label:  manualForm.table_label  || undefined,
        client_name:  manualForm.client_name  || undefined,
        client_phone: manualForm.client_phone || undefined,
        note:         manualForm.note         || undefined,
        items,
      });
      setOrders(prev => [result.order || result, ...prev]);
      setShowManual(false);
      setManualCart({});
      setManualForm({ client_name: "", client_phone: "", table_label: "", note: "" });
    } catch (e) {
      setManualErr(e.response?.data?.message || "Erreur lors de la création");
    }
    setSubmittingM(false);
  };

  // ── Modification d'une commande ──
  const openEditOrder = (order) => {
    const cart = {};
    (order.items || []).forEach(it => {
      cart[it.id || it.name] = { item: it, qty: it.qty };
    });
    setEditOrder(order);
    setEditCart(cart);
    setEditNote(order.note || "");  // colonne DB = 'note' (singulier)
  };

  const editItems  = Object.values(editCart);
  const editTotal  = editItems.reduce((s, { item, qty }) => s + (item.price || 0) * qty, 0);

  const addToEdit  = (item) =>
    setEditCart(p => ({ ...p, [item.id || item.name]: { item, qty: (p[item.id || item.name]?.qty || 0) + 1 } }));
  const remFromEdit = (key) =>
    setEditCart(p => {
      const qty = (p[key]?.qty || 0) - 1;
      if (qty <= 0) { const n = { ...p }; delete n[key]; return n; }
      return { ...p, [key]: { ...p[key], qty } };
    });

  const saveEditOrder = async () => {
    if (!editOrder) return;
    try {
      const items = editItems.map(({ item, qty }) => ({
        id: item.id, name: item.name, price: item.price || 0, qty,
      }));
      await ordersService.updateItems(editOrder.id, items, editNote);
      setOrders(prev => prev.map(o => o.id === editOrder.id
        ? { ...o, items, total: editTotal, note: editNote }
        : o
      ));
      setEditOrder(null);
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: MUTED,
      fontSize: 13, fontFamily: FONT }}>Chargement…</div>
  );

  if (!qrActive) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ fontFamily: FONT, textAlign: "center", padding: "60px 0" }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: PL,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px" }}>
        <ShoppingBag size={26} color={P} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: DARK, marginBottom: 6 }}>
        Menu QR désactivé
      </div>
      <div style={{ fontSize: 13, color: MUTED }}>
        Activez le Menu QR dans l'onglet <strong>Menu & QR Code</strong> pour recevoir des commandes.
      </div>
    </motion.div>
  );

  const pending = orders.filter(o => o.status === "en_attente").length;
  const inProg  = orders.filter(o => o.status === "en_cours").length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <PageTitle title="Commandes" subtitle="QR + prise de commande manuelle" />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowManual(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                borderRadius: 9, border: "none", background: P, color: "#1A1000",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
              <Plus size={13} />Nouvelle commande
            </button>
          <button onClick={refresh} disabled={refreshing}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 9, border: `0.5px solid ${BORDER}`, background: "white",
              fontSize: 12, color: MUTED, cursor: "pointer", fontFamily: FONT }}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Actualiser
          </button>
          </div>
        </div>
      </motion.div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* KPIs */}
      <motion.div variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "En attente",     val: pending,                             color: "#C47D1A", icon: Clock },
          { label: "En cours",       val: inProg,                              color: "#185FA5", icon: RefreshCw },
          { label: "Servis",         val: orders.filter(o=>o.status==="servi").length, color: S, icon: CheckCircle },
          { label: "Total commandes",val: orders.length,                       color: DARK,      icon: ShoppingBag },
        ].map(({ label, val, color, icon: Icon }) => (
          <div key={label} style={{ background: "white", border: `0.5px solid ${BORDER}`,
            borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <Icon size={13} color={color} />
              <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </motion.div>

      {/* Onglets */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {["commandes","stats"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "7px 16px", borderRadius: 9, border: `0.5px solid ${activeTab===t ? P : BORDER}`,
              background: activeTab===t ? PL : "white",
              color: activeTab===t ? "#C47D1A" : MUTED,
              fontWeight: activeTab===t ? 600 : 400,
              fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
            {t === "commandes" ? "Commandes" : "Statistiques"}
          </button>
        ))}
        {/* Filtre statut */}
        {activeTab === "commandes" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {["", "en_attente", "en_cours", "servi", "annule"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: "5px 10px", borderRadius: 8,
                  border: `0.5px solid ${statusFilter===s ? P : BORDER}`,
                  background: statusFilter===s ? PL : "white",
                  color: statusFilter===s ? "#C47D1A" : MUTED,
                  fontSize: 11, cursor: "pointer", fontFamily: FONT }}>
                {s === "" ? "Tous" : STATUS_COLORS[s]?.label || s}
              </button>
            ))}
          </div>
        )}
        {activeTab === "stats" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                style={{ padding: "5px 10px", borderRadius: 8,
                  border: `0.5px solid ${period===p.key ? P : BORDER}`,
                  background: period===p.key ? PL : "white",
                  color: period===p.key ? "#C47D1A" : MUTED,
                  fontSize: 11, cursor: "pointer", fontFamily: FONT }}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Onglet commandes ── */}
      {activeTab === "commandes" && (
        <motion.div variants={fadeUp}>
          <Card>
            <SectionHeader title={`${orders.length} commande${orders.length !== 1 ? "s" : ""}`} icon={ShoppingBag} />
            {orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: MUTED, fontSize: 13 }}>
                Aucune commande pour cette période
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {orders.map(order => (
                  <motion.div key={order.id} layout
                    style={{ border: `0.5px solid ${BORDER}`, borderRadius: 12,
                      padding: "12px 14px", background: "white" }}>
                    <div style={{ display: "flex", alignItems: "center",
                      justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <StatusBadge status={order.status} />
                        {order.table_label && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: DARK }}>
                            Table {order.table_label}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: MUTED }}>{fmtDate(order.created_at)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: P }}>{fmt(order.total)}</span>
                        <PrintReceipt order={order} restoName={restoName} />
                      </div>
                    </div>

                    {/* Items — avec détails (cuisson, accompagnement, note) */}
                    <div style={{ marginBottom: 8 }}>
                      {(order.items || []).map((it, i) => {
                        const opts = it.options || {};
                        const accs = Array.isArray(opts.accompagnements) ? opts.accompagnements
                          : (opts.accompagnement ? [opts.accompagnement] : []);
                        const details = it.options_label || [opts.cuisson, ...accs].filter(Boolean).join(" · ");
                        return (
                          <div key={i} style={{ fontSize: 12, color: DARK, padding: "3px 0",
                            borderBottom: i < (order.items.length - 1) ? "0.5px solid #f2f0eb" : "none" }}>
                            <div>
                              <strong>{it.qty}×</strong> {it.name}
                            </div>
                            {details && (
                              <div style={{ fontSize: 11, color: P, marginTop: 1 }}>
                                {details}
                              </div>
                            )}
                            {it.note && (
                              <div style={{ fontSize: 11, color: MUTED, fontStyle: "italic", marginTop: 1 }}>
                                Note : {it.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions statut */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {order.status !== "servi" && order.status !== "annule" && <>
                        {order.status === "en_attente" && (
                          <button onClick={() => updateStatus(order.id, "en_cours")}
                            style={{ fontSize: 11, padding: "4px 12px", borderRadius: 7,
                              border: "none", background: "#DBEAFE", color: "#1E40AF",
                              cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
                            Prendre en charge
                          </button>
                        )}
                        {order.status === "en_cours" && (
                          <button onClick={() => updateStatus(order.id, "servi")}
                            style={{ fontSize: 11, padding: "4px 12px", borderRadius: 7,
                              border: "none", background: "#D1FAE5", color: "#065F46",
                              cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
                            Marquer servi
                          </button>
                        )}
                        <button onClick={() => openEditOrder(order)}
                          style={{ fontSize: 11, padding: "4px 12px", borderRadius: 7,
                            border: `0.5px solid ${BORDER}`, background: "white", color: DARK,
                            cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
                          <Pencil size={10} />Modifier
                        </button>
                        <button onClick={() => updateStatus(order.id, "annule")}
                          style={{ fontSize: 11, padding: "4px 12px", borderRadius: 7,
                            border: `0.5px solid #FCA5A5`, background: "#FEF2F2", color: "#991B1B",
                            cursor: "pointer", fontFamily: FONT }}>
                          Annuler
                        </button>
                      </>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── Onglet stats ── */}
      {activeTab === "stats" && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>

          {/* Chiffres clés */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Chiffres clés" icon={BarChart3} />
              {[
                { label: "Commandes",       val: stats.totals?.total_orders || 0 },
                { label: "Chiffre d'affaires", val: fmt(stats.totals?.total_revenue) },
                { label: "Panier moyen",    val: fmt(Math.round(stats.totals?.avg_order || 0)) },
                { label: "Servies",         val: stats.totals?.served || 0 },
                { label: "Annulées",        val: stats.totals?.cancelled || 0 },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  padding: "7px 0", borderBottom: `0.5px solid ${BORDER}`, fontSize: 13 }}>
                  <span style={{ color: MUTED }}>{label}</span>
                  <span style={{ fontWeight: 600, color: DARK }}>{val}</span>
                </div>
              ))}
            </Card>
          </motion.div>

          {/* Top plats */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Plats les plus commandés" icon={Award} />
              {(stats.top_items || []).length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED, padding: "16px 0", textAlign: "center" }}>
                  Aucune donnée
                </div>
              ) : (
                (stats.top_items || []).slice(0, 7).map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "6px 0", borderBottom: `0.5px solid ${BG}` }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%",
                      background: i < 3 ? PL : BG, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700,
                      color: i < 3 ? P : MUTED, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: DARK }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{item.total_qty}x</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: P }}>{fmt(item.revenue)}</div>
                  </div>
                ))
              )}
            </Card>
          </motion.div>

          {/* Plats les moins commandés */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Plats les moins commandés" icon={AlertTriangle} />
              {(stats.bottom_items || []).length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED, padding: "16px 0", textAlign: "center" }}>
                  Aucune donnée
                </div>
              ) : (
                (stats.bottom_items || []).slice(0, 5).map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "6px 0", borderBottom: `0.5px solid ${BG}`, fontSize: 13 }}>
                    <div style={{ flex: 1, color: DARK }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{item.total_qty}x</div>
                  </div>
                ))
              )}
            </Card>
          </motion.div>

          {/* Évolution journalière */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Revenus journaliers" icon={TrendingUp} />
              {(stats.daily_revenue || []).length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED, padding: "16px 0", textAlign: "center" }}>
                  Aucune donnée
                </div>
              ) : (() => {
                const max = Math.max(...stats.daily_revenue.map(d => +d.revenue || 0), 1);
                return stats.daily_revenue.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "5px 0", fontSize: 12 }}>
                    <div style={{ width: 60, color: MUTED, flexShrink: 0 }}>
                      {new Date(d.day).toLocaleDateString("fr-FR", { day:"2-digit", month:"short" })}
                    </div>
                    <div style={{ flex: 1, height: 8, background: BG, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 4, background: P,
                        width: `${(+d.revenue / max) * 100}%`, transition: "width .4s" }} />
                    </div>
                    <div style={{ fontWeight: 600, color: DARK, minWidth: 80, textAlign: "right" }}>
                      {fmt(d.revenue)}
                    </div>
                  </div>
                ));
              })()}
            </Card>
          </motion.div>
        </div>
      )}

      {activeTab === "stats" && !stats && (
        <Card>
          <div style={{ textAlign: "center", padding: "36px 0", color: MUTED, fontSize: 13 }}>
            Aucune statistique disponible — les données apparaîtront dès la première commande.
          </div>
        </Card>
      )}

      {/* ── MODALE : Nouvelle commande manuelle ──────────────────────────── */}
      <AnimatePresence>
        {showManual && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowManual(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50 }} />
            <div style={{ position: "fixed", inset: 0, zIndex: 60,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16, pointerEvents: "none" }}>
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 360, damping: 32 }}
              style={{ background: "white", borderRadius: 16, padding: 24,
                width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,.2)", fontFamily: FONT,
                pointerEvents: "auto" }}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>Nouvelle commande</div>
                <button onClick={() => setShowManual(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <X size={18} color={MUTED} />
                </button>
              </div>

              {/* Infos client + table */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Nom client", key: "client_name", ph: "Jean Kouassi" },
                  { label: "Téléphone", key: "client_phone", ph: "+225 07 00 00 00 00" },
                  { label: "Numéro de table", key: "table_label", ph: "T1" },
                  { label: "Note", key: "note", ph: "Sans piment…" },
                ].map(({ label, key, ph }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4, fontWeight: 600 }}>{label}</label>
                    <input value={manualForm[key]} onChange={e => setManualForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph}
                      style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 8,
                        padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: FONT,
                        background: BG, color: DARK, boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>

              {/* Sélection des plats depuis le menu */}
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase",
                letterSpacing: "0.8px", marginBottom: 10 }}>Articles</div>
              <div style={{ maxHeight: 280, overflowY: "auto", borderRadius: 8,
                border: `0.5px solid ${BORDER}`, marginBottom: 16 }}>
                {menuCats.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: MUTED }}>
                    Activez le menu QR pour choisir des articles
                  </div>
                ) : menuCats.map(cat => (
                  <div key={cat.id}>
                    <div style={{ padding: "6px 12px", background: BG, fontSize: 10, fontWeight: 700,
                      color: MUTED, textTransform: "uppercase", letterSpacing: "1px" }}>
                      {cat.name}
                    </div>
                    {(cat.items || []).filter(i => i.is_active !== false).map(item => {
                      const qty = manualCart[item.id]?.qty || 0;
                      return (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px", borderBottom: `0.5px solid ${BG}` }}>
                          {item.image_url && (
                            <img src={item.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
                              onError={e => { e.target.style.display = "none"; }} />
                          )}
                          <div style={{ flex: 1, fontSize: 12, color: DARK }}>{item.name}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: P, minWidth: 70 }}>{fmt(item.price)}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {qty > 0 && (
                              <button onClick={() => remFromManual(item.id)}
                                style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${BORDER}`,
                                  background: "white", cursor: "pointer", display: "flex",
                                  alignItems: "center", justifyContent: "center" }}>
                                <Minus size={10} color={MUTED} />
                              </button>
                            )}
                            {qty > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: P, minWidth: 14, textAlign: "center" }}>{qty}</span>}
                            <button onClick={() => addToManual(item)}
                              style={{ width: 26, height: 26, borderRadius: "50%", border: "none",
                                background: P, cursor: "pointer", display: "flex",
                                alignItems: "center", justifyContent: "center" }}>
                              <Plus size={10} color="white" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Récap */}
              {manualItems.length > 0 && (
                <div style={{ background: BG, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: DARK }}>
                    <span>{manualItems.length} article{manualItems.length > 1 ? "s" : ""}</span>
                    <span style={{ color: P }}>{fmt(manualTotal)}</span>
                  </div>
                </div>
              )}

              {manualErr && (
                <div style={{ padding: "8px 12px", background: "#FAECE7", borderRadius: 8,
                  fontSize: 12, color: "#993C1D", marginBottom: 12 }}>{manualErr}</div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowManual(false)}
                  style={{ flex: 1, border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 0",
                    background: "white", cursor: "pointer", fontSize: 13, color: MUTED }}>
                  Annuler
                </button>
                <button onClick={submitManual} disabled={submittingM || manualItems.length === 0}
                  style={{ flex: 2, border: "none", borderRadius: 9, padding: "11px 0",
                    background: manualItems.length === 0 ? MUTED : P,
                    color: "#1A1000", fontSize: 13, fontWeight: 700,
                    cursor: manualItems.length === 0 ? "not-allowed" : "pointer" }}>
                  {submittingM ? "Envoi…" : `Créer la commande · ${fmt(manualTotal)}`}
                </button>
              </div>
            </motion.div>
            </div> {/* ferme le wrapper flex centré */}
          </>
        )}
      </AnimatePresence>

      {/* ── MODALE : Modifier une commande ─────────────────────────────── */}
      <AnimatePresence>
        {editOrder && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditOrder(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50 }} />
            <div style={{ position: "fixed", inset: 0, zIndex: 60,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16, pointerEvents: "none" }}>
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 360, damping: 32 }}
              style={{ background: "white", borderRadius: 16, padding: 24,
                width: "100%", maxWidth: 540, maxHeight: "85vh", overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,.2)", fontFamily: FONT,
                pointerEvents: "auto" }}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>Modifier la commande</div>
                  {editOrder.table_label && (
                    <div style={{ fontSize: 12, color: MUTED }}>Table {editOrder.table_label}</div>
                  )}
                </div>
                <button onClick={() => setEditOrder(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <X size={18} color={MUTED} />
                </button>
              </div>

              {/* Articles existants */}
              <div style={{ maxHeight: 260, overflowY: "auto", borderRadius: 8,
                border: `0.5px solid ${BORDER}`, marginBottom: 14 }}>
                {menuCats.map(cat => (
                  <div key={cat.id}>
                    <div style={{ padding: "5px 12px", background: BG, fontSize: 10, fontWeight: 700,
                      color: MUTED, textTransform: "uppercase" }}>{cat.name}</div>
                    {(cat.items || []).filter(i => i.is_active !== false).map(item => {
                      const key = item.id || item.name;
                      const qty = editCart[key]?.qty || 0;
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 10,
                          padding: "7px 12px", borderBottom: `0.5px solid ${BG}` }}>
                          <div style={{ flex: 1, fontSize: 12, color: DARK }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: P, minWidth: 64 }}>{fmt(item.price)}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {qty > 0 && (
                              <button onClick={() => remFromEdit(key)}
                                style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${BORDER}`,
                                  background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Minus size={9} color={MUTED} />
                              </button>
                            )}
                            {qty > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: P, minWidth: 12, textAlign: "center" }}>{qty}</span>}
                            <button onClick={() => addToEdit(item)}
                              style={{ width: 24, height: 24, borderRadius: "50%", border: "none",
                                background: P, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Plus size={9} color="white" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Note */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4, fontWeight: 600 }}>Note</label>
                <input value={editNote} onChange={e => setEditNote(e.target.value)}
                  placeholder="Instructions spéciales…"
                  style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 8,
                    padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: FONT,
                    background: BG, boxSizing: "border-box" }} />
              </div>

              {editItems.length > 0 && (
                <div style={{ background: BG, borderRadius: 8, padding: "10px 14px",
                  marginBottom: 14, fontSize: 13, fontWeight: 700, color: DARK,
                  display: "flex", justifyContent: "space-between" }}>
                  <span>Total</span>
                  <span style={{ color: P }}>{fmt(editTotal)}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setEditOrder(null)}
                  style={{ flex: 1, border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 0",
                    background: "white", cursor: "pointer", fontSize: 13, color: MUTED }}>
                  Annuler
                </button>
                <button onClick={saveEditOrder}
                  style={{ flex: 2, border: "none", borderRadius: 9, padding: "11px 0",
                    background: P, color: "#1A1000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Enregistrer les modifications
                </button>
              </div>
            </motion.div>
            </div> {/* ferme le wrapper flex centré */}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
