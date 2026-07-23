import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Wine, RefreshCw, Check, X, BadgeCheck, Armchair, Crown, Plus, Minus, Users, Bell, BellOff, Shield, Eye, EyeOff } from "lucide-react";
import { eventStaffService, eventOpsService } from "../../services/events.service.js";
import { clearTokens } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { CheckinTab, EventRecusTab } from "../event/EventTabs2.jsx";
import { playOrderAlarm, unlockAudio } from "../../utils/sound.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";
const KEY = "tci_staff_session";
const ACT_KEY = "tci_staff_activity";
const INACTIVITY_MS = 30 * 60 * 1000; // déconnexion après 30 min SANS interaction
const touchActivity = () => { try { localStorage.setItem(ACT_KEY, String(Date.now())); } catch {} };

export default function StaffConsole() {
  // La session survit au rafraîchissement (localStorage). Elle n'est effacée que
  // si le staff est resté INACTIF plus de 30 min (sécurité si l'appareil traîne).
  const [session, setSession] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (!s) return null;
      const last = parseInt(localStorage.getItem(ACT_KEY) || "0", 10);
      if (last && Date.now() - last > INACTIVITY_MS) { localStorage.removeItem(KEY); localStorage.removeItem(ACT_KEY); return null; }
      return s;
    } catch { return null; }
  });
  const [tab, setTab] = useState("checkin");

  const logout = () => { localStorage.removeItem(KEY); localStorage.removeItem(ACT_KEY); setSession(null); };
  // Session staff expirée/révoquée (401/403) → on déconnecte et on revient au PIN.
  const onExpire = (e) => { if ([401, 403].includes(e?.response?.status)) { logout(); return true; } return false; };
  const firstTab = (r) => (r === "bar" || r === "caisse") ? "orders" : r === "serveur" ? "service" : "checkin";

  // Suivi d'activité + déconnexion auto après 30 min d'inactivité
  useEffect(() => {
    if (!session) return;
    touchActivity();
    const evs = ["pointerdown", "keydown", "touchstart"];
    evs.forEach(e => window.addEventListener(e, touchActivity, { passive: true }));
    const id = setInterval(() => {
      const last = parseInt(localStorage.getItem(ACT_KEY) || "0", 10);
      if (last && Date.now() - last > INACTIVITY_MS) logout();
    }, 30000);
    return () => { evs.forEach(e => window.removeEventListener(e, touchActivity)); clearInterval(id); };
  }, [session]);

  if (!session) return <Login onOk={(s) => { unlockAudio(); touchActivity(); localStorage.setItem(KEY, JSON.stringify(s)); setSession(s); setTab(firstTab(s.staff.role)); }} />;

  const role = session.staff?.role || "all";
  const canCheckin = role === "all" || role === "checkin";
  const canOrders = role === "all" || role === "bar" || role === "caisse";
  const canServe = role === "all" || role === "serveur";
  const canRecus = canServe || canOrders; // serveur / bar / caisse / all
  const tabs = [
    canServe && ["service", "Mes tables"],
    canCheckin && ["checkin", "Check-in"],
    canOrders && ["orders", "Commandes"],
    canRecus && ["recus", "Reçus"],
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
        {active === "recus"   && <EventRecusTab eventId={session.event.id} staffToken={session.token} onAuthError={onExpire} eventName={session.event?.name} />}
      </div>
    </div>
  );
}

function Login({ onOk }) {
  const [mode, setMode] = useState("staff"); // "staff" | "orga"
  // Staff
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  // Organisateur
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const submitStaff = async () => {
    if (!slug.trim()) { setErr("Entrez le code de l'événement."); return; }
    if (!pin.trim())  { setErr("Entrez votre PIN."); return; }
    setBusy(true);
    try {
      const s = await eventStaffService.login(slug.trim().toLowerCase(), pin.trim());
      // Isolation : une session staff n'est jamais mêlée à une session utilisateur.
      clearTokens();
      onOk(s);
    } catch (e2) {
      const st = e2.response?.status;
      setErr(st === 429 ? "Trop de tentatives. Réessayez dans un instant."
        : e2.response?.data?.message || "Code événement ou PIN incorrect.");
      setBusy(false);
    }
  };
  const submitOrga = async () => {
    if (!email.trim() || !password) { setErr("Entrez votre e-mail et votre mot de passe."); return; }
    setBusy(true);
    try {
      // Isolation : une connexion organisateur efface toute session staff résiduelle.
      localStorage.removeItem(KEY); localStorage.removeItem(ACT_KEY);
      const u = await login(email.trim().toLowerCase(), password, true);
      if (u?.role === "organisateur")      navigate("/event");
      else if (u?.role === "admin")        navigate("/admin");
      else if (u?.role === "restaurateur") navigate("/restaurant");
      else {
        // Compte valide mais sans accès organisateur : message clair au lieu d'un
        // renvoi muet vers l'accueil (typiquement un compte client).
        setErr("Ce compte n'a pas d'accès organisateur. Vérifiez que vous utilisez le compte organisateur fourni, ou contactez l'administrateur pour activer l'accès.");
        setBusy(false);
      }
    } catch (e2) {
      const st = e2.response?.status;
      if (st === 403 && e2.response?.data?.code === "EMAIL_NOT_VERIFIED") setErr("Vérifiez votre e-mail avant de vous connecter (consultez vos spams).");
      else setErr(st === 429 ? "Trop de tentatives. Réessayez dans un instant."
        : e2.response?.data?.message || "E-mail ou mot de passe incorrect.");
      setBusy(false);
    }
  };
  const submit = (e) => { e.preventDefault(); setErr(""); mode === "staff" ? submitStaff() : submitOrga(); };
  // Changer d'onglet vide les champs de l'autre connexion (aucun mélange de saisie).
  const switchMode = (m) => {
    setErr("");
    if (m === "staff") { setEmail(""); setPassword(""); }
    else { setSlug(""); setPin(""); }
    setMode(m);
  };

  const isStaff = mode === "staff";
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT }}>
      <form onSubmit={submit} style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 16, padding: "22px 26px 28px", width: "100%", maxWidth: 380 }}>
        <button type="button" onClick={() => navigate("/connexion")}
          style={{ alignSelf: "flex-start", background: "transparent", border: "none", cursor: "pointer",
            fontSize: 12.5, color: MUTED, marginBottom: 14, display: "flex", alignItems: "center", gap: 5, padding: 0, fontFamily: FONT }}>
          ← Retour
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          {isStaff ? <BadgeCheck size={22} color={P} /> : <Shield size={22} color={P} />}
          <div style={{ fontSize: 19, fontWeight: 800, color: DARK }}>{isStaff ? "Console Staff" : "Espace Organisateur"}</div>
        </div>

        {/* Choix du type de connexion */}
        <div style={{ display: "flex", gap: 8, background: BG, borderRadius: 12, padding: 4, marginBottom: 18 }}>
          {[["staff", "Staff"], ["orga", "Organisateur"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => switchMode(k)}
              style={{ flex: 1, border: "none", borderRadius: 9, padding: "9px 0", cursor: "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
                background: mode === k ? "white" : "transparent", color: mode === k ? DARK : MUTED,
                boxShadow: mode === k ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
              {label}
            </button>
          ))}
        </div>

        {err && <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#DC2626", fontSize: 12.5, borderRadius: 8, padding: "9px 12px", marginBottom: 12 }}>{err}</div>}

        {isStaff ? (
          <>
            <label style={lbl}>Code événement</label>
            <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="ex : soiree-afro-vibes" style={inp} autoCapitalize="none" />
            <label style={{ ...lbl, marginTop: 12 }}>PIN</label>
            <input value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" inputMode="numeric" style={{ ...inp, letterSpacing: 4, fontWeight: 700 }} />
          </>
        ) : (
          <>
            <label style={lbl}>E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="vous@exemple.com" style={inp} autoCapitalize="none" autoComplete="email" />
            <label style={{ ...lbl, marginTop: 12 }}>Mot de passe</label>
            <div style={{ position: "relative" }}>
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPwd ? "text" : "password"} placeholder="••••••••" style={{ ...inp, paddingRight: 42 }} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPwd(v => !v)} aria-label="Afficher le mot de passe"
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: MUTED, padding: 6 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </>
        )}

        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 18, border: "none", borderRadius: 11, padding: "13px 0", background: P, color: "#1A1000", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: FONT }}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
        <div style={{ fontSize: 11.5, color: MUTED, textAlign: "center", marginTop: 14 }}>
          {isStaff ? "Code de l'événement + votre PIN (remis par l'organisateur)." : "Vos identifiants habituels d'organisateur."}
        </div>
      </form>
    </div>
  );
}

function OrdersBoard({ eventId, token, onExpire }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(() => localStorage.getItem("tci_order_sound") !== "off");
  const seenRef = useRef(null);   // null = 1er chargement (pas d'alarme)
  const soundRef = useRef(sound); soundRef.current = sound;
  const load = () => eventOpsService.listOrders(eventId, token).then(d => {
    const list = d?.orders || [];
    const ids = new Set(list.map(o => o.id));
    if (seenRef.current === null) { seenRef.current = ids; }
    else {
      const hasNew = list.some(o => !seenRef.current.has(o.id) && o.status === "en_attente");
      seenRef.current = ids;
      if (hasNew && soundRef.current) playOrderAlarm();
    }
    setOrders(list);
  }).catch(e => { if (!onExpire?.(e)) console.error(e); }).finally(() => setLoading(false));
  // Rafraîchi souvent (8 s) → commandes visibles quasi en temps réel
  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [eventId]);
  const toggleSound = () => { const v = !sound; setSound(v); localStorage.setItem("tci_order_sound", v ? "on" : "off"); unlockAudio(); if (v) playOrderAlarm(); };
  const setStatus = async (o, status) => { try { await eventOpsService.setOrderStatus(o.id, status, token, eventId); load(); } catch (e) { if (!onExpire?.(e)) alert(e.response?.data?.message || "Erreur"); } };

  const ST = { en_attente: ["En attente", "#C47D1A", "#FEF6EC"], servi: ["Servi", GREEN, "#F0F6F2"], paye: ["Payé", "#2563EB", "#EFF6FF"], annule: ["Annulé", "#DC2626", "#FEF2F2"] };
  if (loading) return <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>Chargement…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: DARK, display: "flex", alignItems: "center", gap: 7 }}><Wine size={17} color={P} /> Commandes</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={toggleSound} title={sound ? "Alerte sonore activée" : "Alerte sonore coupée"}
            style={{ border: `0.5px solid ${sound ? P : BORDER}`, background: sound ? "#FEF6EC" : "white", borderRadius: 8, padding: "6px 10px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: sound ? "#8a5a10" : MUTED, fontFamily: FONT }}>
            {sound ? <Bell size={13} /> : <BellOff size={13} />} Son
          </button>
          <button onClick={load} style={{ border: `0.5px solid ${BORDER}`, background: "white", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: MUTED, fontFamily: FONT }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>
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
  const [sound, setSound] = useState(() => localStorage.getItem("tci_order_sound") !== "off");
  const seenRef = useRef(null);
  const soundRef = useRef(sound); soundRef.current = sound;
  const load = () => eventOpsService.listServerTables(eventId, token).then(d => {
    const all = (d?.tables || []).flatMap(t => t.orders || []);
    const ids = new Set(all.map(o => o.id));
    if (seenRef.current === null) { seenRef.current = ids; }
    else {
      const hasNew = all.some(o => !seenRef.current.has(o.id) && o.status === "en_attente");
      seenRef.current = ids;
      if (hasNew && soundRef.current) playOrderAlarm();
    }
    setData(d);
  }).catch(e => { if (!onExpire?.(e)) console.error(e); }).finally(() => setLoading(false));
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, [eventId]);
  const toggleSound = () => { const v = !sound; setSound(v); localStorage.setItem("tci_order_sound", v ? "on" : "off"); unlockAudio(); if (v) playOrderAlarm(); };

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
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={toggleSound} title={sound ? "Alerte sonore activée" : "Alerte sonore coupée"}
            style={{ border: `0.5px solid ${sound ? P : BORDER}`, background: sound ? "#FEF6EC" : "white", borderRadius: 8, padding: "6px 10px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: sound ? "#8a5a10" : MUTED, fontFamily: FONT }}>
            {sound ? <Bell size={13} /> : <BellOff size={13} />} Son
          </button>
          <button onClick={load} style={{ border: `0.5px solid ${BORDER}`, background: "white", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: MUTED, fontFamily: FONT }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>
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
  const [oc, setOc] = useState("__all__"); // catégorie active (navigation rapide)
  const inc = (id, d) => setQty(q => { const n = Math.max(0, Math.min(99, (q[id] || 0) + d)); const c = { ...q }; if (n) c[id] = n; else delete c[id]; return c; });
  const lines = bottles.filter(b => qty[b.id]).map(b => ({ id: b.id, qty: qty[b.id], name: b.name, price: b.price }));
  const total = lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);
  // Regroupement par catégorie — insensible à la casse (« softs » et « Softs » = 1 seule).
  const cats = {}; const catLabel = {};
  for (const b of bottles) {
    const raw = (b.category || "Bouteilles").trim();
    const key = raw.toLowerCase();
    const label = catLabel[key] || (catLabel[key] = raw); // 1re casse rencontrée = libellé
    (cats[label] ||= []).push(b);
  }

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

        {/* Navigation par catégorie (évite une longue liste à faire défiler) */}
        {Object.keys(cats).length > 1 && (
          <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "10px 18px 0" }}>
            {[["__all__", "Tout"], ...Object.keys(cats).map(c => [c, c])].map(([k, label]) => (
              <button key={k} onClick={() => setOc(k)}
                style={{ flexShrink: 0, border: `1px solid ${oc === k ? P : BORDER}`, background: oc === k ? "#FEF6EC" : "white",
                  color: oc === k ? "#8a5a10" : MUTED, borderRadius: 18, padding: "5px 13px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div style={{ overflowY: "auto", padding: "12px 18px", flex: 1 }}>
          {Object.entries(cats).filter(([cat]) => oc === "__all__" || cat === oc).map(([cat, items]) => (
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
