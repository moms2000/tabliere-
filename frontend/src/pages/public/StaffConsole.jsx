import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LogOut, Wine, UserCheck, RefreshCw, Check, X, Clock, BadgeCheck, Armchair, Crown, Plus, Minus, Users } from "lucide-react";
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
  // Session staff expirée/révoquée (401/403) → on déconnecte et on revient au PIN.
  const onExpire = (e) => { if ([401, 403].includes(e?.response?.status)) { logout(); return true; } return false; };
  const firstTab = (r) => (r === "bar" || r === "caisse") ? "orders" : r === "serveur" ? "service" : "checkin";
  if (!session) return <Login onOk={(s) => { localStorage.setItem(KEY, JSON.stringify(s)); setSession(s); setTab(firstTab(s.staff.role)); }} />;

  const role = session.staff?.role || "all";
  const canCheckin = role === "all" || role === "checkin";
  const canOrders = role === "all" || role === "bar" || role === "caisse";
  const canServe = role === "all" || role === "serveur";
  const tabs = [
    canServe && ["service", "Mes tables"],
    canCheckin && ["checkin", "Check-in"],
    canOrders && ["orders", "Commandes"],
  ].filter(Boolean);
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
        {active === "service" && <ServerBoard eventId={session.event.id} token={session.token} onExpire={onExpire} />}
        {active === "checkin" && <CheckinTab eventId={session.event.id} staffToken={session.token} onAuthError={onExpire} />}
        {active === "orders"  && <OrdersBoard eventId={session.event.id} token={session.token} onExpire={onExpire} />}
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

function OrdersBoard({ eventId, token, onExpire }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => eventOpsService.listOrders(eventId, token).then(d => setOrders(d?.orders || [])).catch(e => { if (!onExpire?.(e)) console.error(e); }).finally(() => setLoading(false));
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [eventId]);
  const setStatus = async (o, status) => { try { await eventOpsService.setOrderStatus(o.id, status, token, eventId); load(); } catch (e) { if (!onExpire?.(e)) alert(e.response?.data?.message || "Erreur"); } };

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
                  {o.server_name && <span style={{ fontSize: 11.5, color: MUTED, display: "inline-flex", alignItems: "center", gap: 3 }}><Armchair size={11} /> {o.server_name}</span>}
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

// ── Interface serveur : mes tables + commande directe (Phase 3) ───────────────
function ServerBoard({ eventId, token, onExpire }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(null); // table sur laquelle on commande
  const load = () => eventOpsService.listServerTables(eventId, token)
    .then(setData).catch(e => { if (!onExpire?.(e)) console.error(e); }).finally(() => setLoading(false));
  useEffect(() => { load(); const id = setInterval(load, 25000); return () => clearInterval(id); }, [eventId]);

  const ST = { en_attente: ["En attente", "#C47D1A", "#FEF6EC"], servi: ["Servi", GREEN, "#F0F6F2"], paye: ["Payé", "#2563EB", "#EFF6FF"], annule: ["Annulé", "#DC2626", "#FEF2F2"] };
  if (loading) return <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>Chargement…</div>;
  const tables = data?.tables || [];
  const bottles = data?.bottles || [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7 }}>
          <Armchair size={17} color={P} /> Mes tables
        </div>
        <button onClick={load} style={{ border: `0.5px solid ${BORDER}`, background: "white", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: MUTED, fontFamily: FONT }}>
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>
      {tables.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: 13 }}>
          Aucune table ne vous est assignée pour l'instant. L'organisateur doit vous attribuer des tables.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {tables.map(t => {
            const orders = t.orders || [];
            const arrived = t.checked_in_at;
            const pax = t.arrived_size != null ? t.arrived_size : t.party_size;
            return (
              <div key={t.id} style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "13px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {t.kind === "vip" ? <Crown size={15} color={P} /> : <Armchair size={15} color={MUTED} />}
                  <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{t.label}</span>
                  {t.zone && t.zone !== "general" && <span style={{ fontSize: 11, color: MUTED }}>· {t.zone}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600,
                    color: arrived ? GREEN : MUTED, background: arrived ? "#F0F6F2" : BG, borderRadius: 8, padding: "3px 9px" }}>
                    {arrived ? "Arrivé" : "En attente"}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#4a5a52", marginBottom: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {t.client_name ? <><Users size={13} color={MUTED} /> {t.client_name}{pax ? ` · ${pax} pers.` : ""}</>
                    : <span style={{ color: MUTED }}>Aucune réservation sur cette table</span>}
                  {t.min_order ? <span style={{ color: MUTED }}>· min. {fmt(t.min_order)}</span> : null}
                </div>

                {orders.length > 0 && (
                  <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                    {orders.map(o => {
                      const st = ST[o.status] || ST.en_attente;
                      const items = Array.isArray(o.items) ? o.items : [];
                      return (
                        <div key={o.id} style={{ background: BG, borderRadius: 9, padding: "8px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: DARK, fontFamily: "monospace" }}>{o.ref}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: st[1], background: "white", borderRadius: 7, padding: "2px 7px" }}>{st[0]}</span>
                            <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: P }}>{fmt(o.total)}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: "#4a5a52" }}>
                            {items.map((it, i) => `${it.qty}× ${it.name}`).join(", ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button onClick={() => setCompose(t)} disabled={bottles.length === 0}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    border: "none", borderRadius: 10, padding: "10px 0", background: bottles.length ? P : "#e8e8e8",
                    color: bottles.length ? "#1A1000" : MUTED, fontSize: 13.5, fontWeight: 700, cursor: bottles.length ? "pointer" : "default", fontFamily: FONT }}>
                  <Plus size={15} /> Nouvelle commande
                </button>
              </div>
            );
          })}
        </div>
      )}

      {compose && (
        <OrderComposer table={compose} bottles={bottles} eventId={eventId} token={token}
          onClose={() => setCompose(null)} onDone={() => { setCompose(null); load(); }} />
      )}
    </div>
  );
}

// Modale de composition d'une commande par le serveur
function OrderComposer({ table, bottles, eventId, token, onClose, onDone }) {
  const [qty, setQty] = useState({}); // { bottleId: n }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inc = (id, d) => setQty(q => { const n = Math.max(0, Math.min(99, (q[id] || 0) + d)); const c = { ...q }; if (n) c[id] = n; else delete c[id]; return c; });
  const lines = bottles.filter(b => qty[b.id]).map(b => ({ id: b.id, qty: qty[b.id], name: b.name, price: b.price }));
  const total = lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);
  // Regroupement par catégorie
  const cats = {};
  for (const b of bottles) (cats[b.category || "Bouteilles"] ||= []).push(b);

  const submit = async () => {
    if (!lines.length) { setErr("Ajoutez au moins un article."); return; }
    setBusy(true); setErr("");
    try {
      await eventOpsService.createServerOrder({ event_id: eventId, table_id: table.id,
        items: lines.map(l => ({ id: l.id, qty: l.qty })), note: note || undefined }, token);
      onDone();
    } catch (e) { setErr(e.response?.data?.message || "Erreur lors de l'envoi."); setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 480, maxHeight: "88vh", borderRadius: "18px 18px 0 0", display: "flex", flexDirection: "column", fontFamily: FONT }}>
        <div style={{ padding: "16px 18px 10px", borderBottom: `0.5px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: DARK }}>Commander · {table.label}</div>
            {table.client_name && <div style={{ fontSize: 12, color: MUTED }}>{table.client_name}</div>}
          </div>
          <button onClick={onClose} style={{ border: "none", background: BG, borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color={MUTED} /></button>
        </div>

        <div style={{ overflowY: "auto", padding: "12px 18px", flex: 1 }}>
          {Object.entries(cats).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{cat}</div>
              <div style={{ display: "grid", gap: 7 }}>
                {items.map(b => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{b.name}</div>
                      <div style={{ fontSize: 12, color: P, fontWeight: 700 }}>{fmt(b.price)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => inc(b.id, -1)} disabled={!qty[b.id]} style={{ ...roundBtn, opacity: qty[b.id] ? 1 : 0.35 }}><Minus size={15} /></button>
                      <span style={{ minWidth: 20, textAlign: "center", fontSize: 15, fontWeight: 700, color: DARK }}>{qty[b.id] || 0}</span>
                      <button onClick={() => inc(b.id, 1)} style={roundBtn}><Plus size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (facultatif)"
            style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, background: BG, outline: "none", fontFamily: FONT, boxSizing: "border-box", color: DARK }} />
        </div>

        <div style={{ padding: "12px 18px calc(env(safe-area-inset-bottom,0px) + 14px)", borderTop: `0.5px solid ${BORDER}` }}>
          {err && <div style={{ color: "#DC2626", fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          <button onClick={submit} disabled={busy || !lines.length}
            style={{ width: "100%", border: "none", borderRadius: 12, padding: "13px 0", background: lines.length ? P : "#e8e8e8",
              color: lines.length ? "#1A1000" : MUTED, fontSize: 15, fontWeight: 700, cursor: lines.length && !busy ? "pointer" : "default", fontFamily: FONT }}>
            {busy ? "Envoi…" : `Envoyer la commande${total ? " · " + fmt(total) : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
const roundBtn = { width: 34, height: 34, borderRadius: "50%", border: `1.5px solid ${BORDER}`, background: "white", color: DARK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT };

const ActBtn = ({ onClick, color, icon: Icon, label, outline }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 5, border: outline ? `0.5px solid ${BORDER}` : "none", borderRadius: 8, padding: "7px 12px", background: outline ? "white" : color, color: outline ? color : "white", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
    <Icon size={14} /> {label}
  </button>
);
const lbl = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#6A7A72", marginBottom: 6 };
const inp = { width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "12px 13px", fontSize: 14, background: BG, outline: "none", fontFamily: FONT, boxSizing: "border-box", color: DARK };
