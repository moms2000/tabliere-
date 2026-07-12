import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LogOut, Wine, UserCheck, RefreshCw, Check, X, Clock, BadgeCheck } from "lucide-react";
import { eventStaffService, eventOpsService } from "../../services/events.service.js";
import { CheckinTab } from "../event/EventTabs2.jsx";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";
const KEY = "tci_staff_session";

export default function StaffConsole() {
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } });
  const [tab, setTab] = useState("checkin");

  const logout = () => { localStorage.removeItem(KEY); setSession(null); };
  if (!session) return <Login onOk={(s) => { localStorage.setItem(KEY, JSON.stringify(s)); setSession(s); setTab(s.staff.role === "bar" ? "orders" : "checkin"); }} />;

  const role = session.staff?.role || "all";
  const canCheckin = role === "all" || role === "checkin";
  const canBar = role === "all" || role === "bar";
  const tabs = [canCheckin && ["checkin", "Check-in"], canBar && ["orders", "Commandes"]].filter(Boolean);
  const active = tabs.find(t => t[0] === tab) ? tab : tabs[0]?.[0];

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT }}>
      <div style={{ background: DARK, padding: "calc(env(safe-area-inset-top,0px) + 12px) 18px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{session.event?.name}</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)" }}>Staff · {session.staff?.name}</div>
        </div>
        <button onClick={logout} style={{ border: "none", background: "rgba(255,255,255,.1)", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,.7)" }}>
          <LogOut size={16} />
        </button>
      </div>

      {tabs.length > 1 && (
        <div style={{ display: "flex", gap: 6, padding: "0 14px", borderBottom: `0.5px solid ${BORDER}`, background: "white" }}>
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: FONT, padding: "12px 14px",
                fontSize: 14, fontWeight: active === k ? 700 : 500, color: active === k ? DARK : MUTED,
                borderBottom: active === k ? `2px solid ${P}` : "2px solid transparent", marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 14px 50px" }}>
        {active === "checkin" && <CheckinTab eventId={session.event.id} staffToken={session.token} />}
        {active === "orders"  && <OrdersBoard eventId={session.event.id} token={session.token} />}
      </div>
    </div>
  );
}

function Login({ onOk }) {
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (!slug.trim()) { setErr("Entrez le code de l'événement."); return; }
    if (!pin.trim())  { setErr("Entrez votre PIN."); return; }
    setBusy(true);
    try {
      const s = await eventStaffService.login(slug.trim().toLowerCase(), pin.trim());
      onOk(s);
    } catch (e2) {
      const st = e2.response?.status;
      setErr(st === 429 ? "Trop de tentatives. Réessayez dans un instant."
        : e2.response?.data?.message || "Code événement ou PIN incorrect.");
    } finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT }}>
      <form onSubmit={submit} style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 16, padding: "32px 26px", width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <BadgeCheck size={22} color={P} />
          <div style={{ fontSize: 19, fontWeight: 800, color: DARK }}>Console Staff</div>
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Connectez-vous avec le code de l'événement et votre PIN.</div>
        {err && <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#DC2626", fontSize: 12.5, borderRadius: 8, padding: "9px 12px", marginBottom: 12 }}>{err}</div>}
        <label style={lbl}>Code événement</label>
        <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="ex : soiree-afro-vibes" style={inp} autoCapitalize="none" />
        <label style={{ ...lbl, marginTop: 12 }}>PIN</label>
        <input value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" inputMode="numeric" style={{ ...inp, letterSpacing: 4, fontWeight: 700 }} />
        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 18, border: "none", borderRadius: 11, padding: "13px 0", background: P, color: "#1A1000", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: FONT }}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

function OrdersBoard({ eventId, token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => eventOpsService.listOrders(eventId, token).then(d => setOrders(d?.orders || [])).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [eventId]);
  const setStatus = async (o, status) => { try { await eventOpsService.setOrderStatus(o.id, status, token, eventId); load(); } catch { alert("Erreur"); } };

  const ST = { en_attente: ["En attente", "#C47D1A", "#FEF6EC"], servi: ["Servi", GREEN, "#F0F6F2"], paye: ["Payé", "#2563EB", "#EFF6FF"], annule: ["Annulé", "#DC2626", "#FEF2F2"] };
  if (loading) return <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>Chargement…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7 }}><Wine size={17} color={P} /> Commandes</div>
        <button onClick={load} style={{ border: `0.5px solid ${BORDER}`, background: "white", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: MUTED, fontFamily: FONT }}>
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>
      {orders.length === 0 ? <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 13 }}>Aucune commande.</div> : (
        <div style={{ display: "grid", gap: 10 }}>
          {orders.map(o => {
            const st = ST[o.status] || ST.en_attente;
            const items = Array.isArray(o.items) ? o.items : [];
            return (
              <div key={o.id} style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: DARK, fontFamily: "monospace" }}>{o.ref}</span>
                  {o.table_label && <span style={{ fontSize: 12.5, color: DARK, background: BG, borderRadius: 6, padding: "2px 8px" }}>{o.table_label}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: st[1], background: st[2], borderRadius: 8, padding: "3px 9px" }}>{st[0]}</span>
                </div>
                <div style={{ fontSize: 13, color: DARK, marginBottom: 8 }}>
                  {items.map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><span>{it.qty}× {it.name}</span><span style={{ color: MUTED }}>{fmt(it.price * it.qty)}</span></div>)}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: `0.5px solid ${BG}` }}><span>Total</span><span style={{ color: P }}>{fmt(o.total)}</span></div>
                  {o.guest_name && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>Par {o.guest_name}</div>}
                  {o.note && <div style={{ fontSize: 11.5, color: MUTED, fontStyle: "italic" }}>« {o.note} »</div>}
                </div>
                {o.status !== "annule" && o.status !== "paye" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {o.status === "en_attente" && <ActBtn onClick={() => setStatus(o, "servi")} color={GREEN} icon={Check} label="Servi" />}
                    <ActBtn onClick={() => setStatus(o, "paye")} color="#2563EB" icon={BadgeCheck} label="Payé" />
                    <ActBtn onClick={() => setStatus(o, "annule")} color="#DC2626" icon={X} label="Annuler" outline />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ActBtn = ({ onClick, color, icon: Icon, label, outline }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 5, border: outline ? `0.5px solid ${BORDER}` : "none", borderRadius: 8, padding: "7px 12px", background: outline ? "white" : color, color: outline ? color : "white", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
    <Icon size={14} /> {label}
  </button>
);
const lbl = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#6A7A72", marginBottom: 6 };
const inp = { width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "12px 13px", fontSize: 14, background: BG, outline: "none", fontFamily: FONT, boxSizing: "border-box", color: DARK };
