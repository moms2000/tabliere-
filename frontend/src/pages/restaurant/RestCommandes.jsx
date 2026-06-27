import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, TrendingUp, BarChart3, CheckCircle,
  Clock, X, RefreshCw, Award, AlertTriangle,
} from "lucide-react";
import { Card, SectionHeader, PageTitle, Badge, Btn } from "../../components/ui";
import { ordersService }     from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";
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

function PrintReceipt({ order, restoName }) {
  const print = () => {
    const w = window.open("", "_blank", "width=400,height=600");
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
            <span>${it.qty}× ${it.name}</span>
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
  const [loading,      setLoading]      = useState(true);
  const [qrActive,     setQrActive]     = useState(true);
  const [period,       setPeriod]       = useState("day");
  const [activeTab,    setActiveTab]    = useState("commandes"); // commandes | stats
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshing,   setRefreshing]   = useState(false);

  const load = useCallback(async () => {
    if (!user?.resto_id) return;
    try {
      const [restoData, ordersData, statsData] = await Promise.all([
        restaurantsService.getManage(user.resto_id),
        ordersService.list({ limit: 100, ...(statusFilter ? { status: statusFilter } : {}) }),
        ordersService.getStats({ period }).catch(() => null),
      ]);
      setRestoName(restoData.restaurant?.name || "");
      setQrActive(restoData.restaurant?.qr_active || false);
      setOrders(ordersData.data || []);
      if (statsData) setStats(statsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.resto_id, period, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); };

  const updateStatus = async (id, status) => {
    try {
      await ordersService.updateStatus(id, status);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
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
          <PageTitle title="Commandes QR" subtitle="Commandes reçues via scan QR" />
          <button onClick={refresh} disabled={refreshing}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 9, border: `0.5px solid ${BORDER}`, background: "white",
              fontSize: 12, color: MUTED, cursor: "pointer", fontFamily: FONT }}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Actualiser
          </button>
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

                    {/* Items */}
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
                      {(order.items || []).map((it, i) => (
                        <span key={i}>
                          {i > 0 && " · "}
                          <strong style={{ color: DARK }}>{it.qty}×</strong> {it.name}
                        </span>
                      ))}
                    </div>

                    {/* Actions statut */}
                    {order.status !== "servi" && order.status !== "annule" && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                        <button onClick={() => updateStatus(order.id, "annule")}
                          style={{ fontSize: 11, padding: "4px 12px", borderRadius: 7,
                            border: `0.5px solid #FCA5A5`, background: "#FEF2F2", color: "#991B1B",
                            cursor: "pointer", fontFamily: FONT }}>
                          Annuler
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── Onglet stats ── */}
      {activeTab === "stats" && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

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
    </motion.div>
  );
}
