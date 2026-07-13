import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Utensils, Phone, Mail, MapPin, Star, Calendar, ShoppingBag, Users, Clock } from "lucide-react";
import { Badge } from "../ui";
import { adminService } from "../../services/admin.service.js";

const P = "#E8A045", DARK = "#1E2E28", BORDER = "#E8E2D9", MUTED = "#9BA89F", GREEN = "#1D9E75", RED = "#DC2626";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const PLAN_BADGE = { premium: "green", standard: "blue", gratuit: "gray" };
const STATUS_BADGE = { actif: "green", suspendu: "red", en_attente: "amber", "en attente": "amber" };
const RESA_BADGE = { confirme: "green", en_attente: "amber", annule: "red", no_show: "red", termine: "gray" };
const fmtFCFA = (n) => (Number(n) || 0).toLocaleString("fr-FR") + " F";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

function Bars({ data, color = P, labelFn }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 90 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>{d.value || ""}</div>
          <div style={{ width: "100%", background: color + "18", borderRadius: "3px 3px 0 0", height: 64, position: "relative" }}>
            <motion.div initial={{ height: 0 }} animate={{ height: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: color, borderRadius: "3px 3px 0 0" }} />
          </div>
          <span style={{ fontSize: 9, color: "#aaa", textAlign: "center", whiteSpace: "nowrap" }}>{labelFn(d)}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, color = DARK, sub }) {
  return (
    <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const Section = ({ icon: Icon, title, children }) => (
  <div style={{ marginTop: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
      color: MUTED, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
      <Icon size={13} color={P} /> {title}
    </div>
    {children}
  </div>
);

export default function RestaurateurDetail({ id, onClose }) {
  const [d, setD]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(false);
    adminService.getRestaurantDetail(id)
      .then(res => { if (alive) setD(res); })
      .catch(() => { if (alive) setErr(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const r  = d?.restaurant;
  const rs = d?.reservations || {};
  const os = d?.orders || {};
  const cn = d?.counts || {};
  const confRate = rs.total ? Math.round((rs.confirmed / rs.total) * 100) : 0;
  const noShowRate = rs.total ? Math.round((rs.no_show / rs.total) * 100) : 0;

  const monthBars = (d?.by_month || []).map(m => {
    const [y, mo] = m.month.split("-");
    return { value: m.count, label: MONTHS[(parseInt(mo, 10) - 1)] || m.month };
  });
  const hourBars = (d?.by_hour || []).map(h => ({ value: h.count, label: `${h.hour}h` }));

  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.35)", zIndex: 120 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 121, display: "flex", alignItems: "flex-start",
        justifyContent: "center", padding: "24px 16px", pointerEvents: "none", overflowY: "auto" }}>
        <motion.div initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          style={{ background: "#FBF9F5", borderRadius: 18, width: "100%", maxWidth: 780,
            fontFamily: FONT, boxShadow: "0 24px 64px rgba(30,46,40,.22)", pointerEvents: "auto",
            overflow: "hidden", margin: "auto" }}>

          {/* Header */}
          <div style={{ background: "white", padding: "20px 24px", borderBottom: `0.5px solid ${BORDER}`,
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: DARK }}>{r?.name || "…"}</div>
                {r && <Badge label={r.plan || "gratuit"} variant={PLAN_BADGE[r.plan] || "gray"} />}
                {r && <Badge label={r.status} variant={STATUS_BADGE[r.status] || "gray"} />}
                {r && <Badge label={r.qr_active ? "QR actif" : "QR off"} variant={r.qr_active ? "green" : "gray"} />}
              </div>
              {r && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: MUTED }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Utensils size={11} /> {r.owner_name || "—"}</span>
                  {r.owner_phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {r.owner_phone}</span>}
                  {r.owner_email && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} /> {r.owner_email}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {[r.quartier, r.ville].filter(Boolean).join(", ") || "—"}</span>
                  <span>Inscrit le {fmtDate(r.created_at)}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: MUTED }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: "18px 24px 26px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: MUTED, fontSize: 13 }}>Chargement de la fiche…</div>
            ) : err ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: RED, fontSize: 13 }}>Impossible de charger la fiche.</div>
            ) : (
              <>
                {/* KPIs réservations */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                  <Kpi label="Réservations" value={rs.total || 0} sub={`${rs.this_month || 0} ce mois`} />
                  <Kpi label="Confirmées" value={rs.confirmed || 0} color={GREEN} sub={`${confRate}% du total`} />
                  <Kpi label="No-show" value={rs.no_show || 0} color={RED} sub={`${noShowRate}% du total`} />
                  <Kpi label="Annulées" value={rs.cancelled || 0} color="#993C1D" />
                  <Kpi label="Couverts servis" value={rs.covers || 0} color={P} sub={`moy. ${rs.avg_party || 0}/résa`} />
                  <Kpi label="Note" value={r?.rating > 0 ? `${r.rating}/5` : "—"} sub={`${r?.review_count || 0} avis`} />
                </div>

                {/* KPIs commandes + config */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 10 }}>
                  <Kpi label="Commandes QR" value={os.count || 0} />
                  <Kpi label="CA commandes" value={fmtFCFA(os.revenue)} color={GREEN} />
                  <Kpi label="Panier moyen" value={fmtFCFA(os.avg_basket)} />
                  <Kpi label="Tables" value={cn.tables || 0} />
                  <Kpi label="Plats au menu" value={cn.menu_items || 0} />
                </div>

                {/* Graphiques */}
                {monthBars.length > 0 && (
                  <Section icon={Calendar} title="Réservations par mois">
                    <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "16px 16px 10px" }}>
                      <Bars data={monthBars} labelFn={(d) => d.label} />
                    </div>
                  </Section>
                )}
                {hourBars.length > 0 && (
                  <Section icon={Clock} title="Heures de pointe">
                    <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "16px 16px 10px" }}>
                      <Bars data={hourBars} color={GREEN} labelFn={(d) => d.label} />
                    </div>
                  </Section>
                )}

                {/* Dernières réservations */}
                <Section icon={Calendar} title="Dernières réservations">
                  {(d?.recent_reservations || []).length === 0 ? (
                    <div style={{ fontSize: 12.5, color: MUTED }}>Aucune réservation.</div>
                  ) : (
                    <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                      {d.recent_reservations.map((x, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          borderTop: i ? `0.5px solid #F1EDE6` : "none" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: MUTED, minWidth: 90 }}>{x.ref}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: DARK, minWidth: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.client_name || "—"}</span>
                          <span style={{ fontSize: 12, color: MUTED }}>{fmtDateTime(x.reserved_at)}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: MUTED }}>
                            <Users size={11} />{x.party_size}</span>
                          <Badge label={x.status} variant={RESA_BADGE[x.status] || "gray"} />
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Dernières commandes */}
                {(d?.recent_orders || []).length > 0 && (
                  <Section icon={ShoppingBag} title="Dernières commandes QR">
                    <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                      {d.recent_orders.map((x, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          borderTop: i ? `0.5px solid #F1EDE6` : "none" }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: DARK }}>{x.client_name || "Client"}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{fmtFCFA(x.total)}</span>
                          <span style={{ fontSize: 12, color: MUTED }}>{fmtDateTime(x.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>,
    document.body
  );
}
