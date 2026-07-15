import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wine, Plus, Minus, ArrowLeft, Check, ShoppingCart, X, Receipt } from "lucide-react";
import { eventsService, eventOpsService } from "../../services/events.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR") + " F";

// Statut d'une commande, vu côté client
const ORDER_ST = {
  en_attente: { label: "En attente", color: "#854F0B", bg: "#FAEEDA" },
  servi:      { label: "Servie",     color: GREEN,     bg: "#F0F6F2" },
  paye:       { label: "Payée",      color: "#185FA5", bg: "#E6F1FB" },
  annule:     { label: "Annulée",    color: "#993C1D", bg: "#FAECE7" },
};
const fmtTime = (d) => { try { return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export default function EventOrder() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const tableLabel = sp.get("label") || null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nf, setNf] = useState(false);
  const [cart, setCart] = useState({});     // { bottleId: qty }
  const [guest, setGuest] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  // Accès responsable : code à 4 chiffres remis à l'entrée (Phase 2)
  const [pin, setPin] = useState("");
  const [verified, setVerified] = useState(null); // { token, table_label } une fois le code validé
  const [pinBusy, setPinBusy] = useState(false);
  const [pinErr, setPinErr] = useState("");

  const verifyPin = async () => {
    if (!/^\d{4}$/.test(pin)) { setPinErr("Entrez le code à 4 chiffres."); return; }
    setPinBusy(true); setPinErr("");
    try {
      const d = await eventOpsService.verifyOrderPin({ slug, pin });
      setVerified(d); // { token, table_label }
    } catch (e) { setPinErr(e.response?.data?.message || "Code invalide."); }
    finally { setPinBusy(false); }
  };

  useEffect(() => {
    eventsService.cartePublic(slug)
      .then(setData).catch(() => setNf(true)).finally(() => setLoading(false));
  }, [slug]);

  // Historique + suivi des commandes du salon (dès que le code est validé).
  // Polling léger toutes les 15 s → le client voit le statut évoluer, et retrouve
  // ses commandes même après un re-scan (le jeton reste valide 10 h).
  const loadOrders = async (token) => {
    try { const d = await eventOpsService.listMyOrders(token); setMyOrders(d?.orders || []); } catch { /* silencieux */ }
  };
  useEffect(() => {
    if (!verified?.token) return;
    let alive = true;
    const run = () => { if (alive) loadOrders(verified.token); };
    run();
    const id = setInterval(run, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [verified?.token]);

  const bottles = data?.bottles || [];
  const byCat = useMemo(() => {
    const m = {};
    bottles.forEach(b => { (m[b.category || "Autres"] ||= []).push(b); });
    return m;
  }, [bottles]);

  const inc = (id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec = (id) => setCart(c => { const q = (c[id] || 0) - 1; const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });

  const lines = bottles.filter(b => cart[b.id]).map(b => ({ ...b, qty: cart[b.id] }));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const mode = data?.event?.ordering_mode || "per_order";

  const submit = async () => {
    if (!count) return;
    setSubmitting(true); setSubmitErr("");
    try {
      const order = await eventOpsService.createOrder({
        slug, order_token: verified?.token,
        guest_name: guest || undefined, note: note || undefined,
        items: lines.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty })),
      });
      setCart({}); setNote(""); setShowCart(false);
      setOkMsg(`Commande ${order.ref} envoyée !`);
      setTimeout(() => setOkMsg(""), 5000);
      if (verified?.token) loadOrders(verified.token); // rafraîchit l'historique tout de suite
    } catch (e) { setSubmitErr(e.response?.data?.message || "Erreur lors de la commande. Réessayez."); }
    finally { setSubmitting(false); }
  };

  if (loading) return <Center>Chargement…</Center>;
  if (nf || !data) return <Center><Wine size={32} color={BORDER} /><div style={{ marginTop: 10 }}>Carte indisponible.</div><button onClick={() => navigate(`/evenement/${slug}`)} style={link}>Voir l'événement</button></Center>;

  // Accès responsable : tant que le code à 4 chiffres n'est pas validé, on
  // n'affiche pas la carte (seul le responsable du salon, muni du code remis à
  // l'entrée, peut commander).
  if (!verified) return (
    <Center>
      <div style={{ width: "100%", maxWidth: 320, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#F0F6F2", display: "flex",
          alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Wine size={28} color={P} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: DARK }}>{data.event?.name}</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
          Entrez le <strong>code à 4 chiffres</strong> remis au responsable du salon à l'entrée pour commander.
        </div>
        <input value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinErr(""); }}
          onKeyDown={e => e.key === "Enter" && verifyPin()}
          inputMode="numeric" placeholder="••••" maxLength={4}
          style={{ width: 180, textAlign: "center", fontSize: 34, letterSpacing: 14, fontWeight: 800,
            padding: "12px 0", borderRadius: 12, border: `1.5px solid ${pinErr ? "#DC2626" : BORDER}`,
            background: "white", color: DARK, outline: "none", fontFamily: "monospace" }} />
        {pinErr && <div style={{ fontSize: 12.5, color: "#DC2626", marginTop: 10 }}>{pinErr}</div>}
        <button onClick={verifyPin} disabled={pinBusy}
          style={{ ...primaryBtn, width: "100%", marginTop: 18, justifyContent: "center" }}>
          {pinBusy ? "Vérification…" : "Accéder à la carte"}
        </button>
      </div>
    </Center>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, paddingBottom: count ? 90 : 20 }}>
      <div style={{ background: DARK, padding: "calc(env(safe-area-inset-top,0px) + 16px) 18px 18px", position: "relative" }}>
        <button onClick={() => navigate(`/evenement/${slug}`)}
          style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 13, marginBottom: 10, padding: 0, fontFamily: FONT }}>
          <ArrowLeft size={15} /> {data.event?.name}
        </button>
        <div style={{ fontSize: 22, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
          <Wine size={20} color={P} /> Carte des bouteilles
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", marginTop: 4 }}>
          {tableLabel ? `Table : ${tableLabel} · ` : verified.table_label ? `Table : ${verified.table_label} · ` : ""}
          Paiement cash sur place{mode === "tab" ? " (note en fin de soirée)" : ""}
        </div>

        {/* Bouton panier — en haut à droite */}
        <button onClick={() => setShowCart(true)} aria-label="Voir le panier"
          style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 16px)", right: 18,
            width: 44, height: 44, borderRadius: 12, border: "none", background: "rgba(255,255,255,.12)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ShoppingCart size={20} color="white" />
          {count > 0 && (
            <span style={{ position: "absolute", top: -5, right: -5, minWidth: 20, height: 20, padding: "0 5px",
              borderRadius: 10, background: P, color: "#1A1000", fontSize: 11.5, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
          )}
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        {okMsg && (
          <div style={{ background: "#F0F6F2", border: `0.5px solid ${GREEN}`, color: GREEN, fontSize: 13,
            fontWeight: 600, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={16} /> {okMsg}
          </div>
        )}

        {/* Mes commandes (historique + suivi de statut) */}
        {myOrders.length > 0 && (
          <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Receipt size={15} color={P} />
              <span style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Mes commandes</span>
              <span style={{ fontSize: 11.5, color: MUTED }}>({myOrders.length})</span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {myOrders.map(o => {
                const st = ORDER_ST[o.status] || ORDER_ST.en_attente;
                const items = Array.isArray(o.items) ? o.items : [];
                return (
                  <div key={o.id} style={{ border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: DARK }}>{o.ref}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 9px", borderRadius: 20 }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                      {items.map(it => `${it.qty}× ${it.name}`).join(" · ") || "—"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: MUTED }}>{fmtTime(o.created_at)}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: P }}>{fmt(o.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {bottles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: MUTED }}>La carte n'est pas encore disponible.</div>
        ) : Object.entries(byCat).map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: P, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{cat}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {list.map(b => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{b.name}</div>
                    {b.description && <div style={{ fontSize: 11.5, color: MUTED }}>{b.description}</div>}
                    <div style={{ fontSize: 13, fontWeight: 700, color: P, marginTop: 2 }}>{fmt(b.price)}</div>
                  </div>
                  {cart[b.id] ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => dec(b.id)} style={qtyBtn}><Minus size={15} /></button>
                      <span style={{ fontSize: 15, fontWeight: 700, color: DARK, minWidth: 16, textAlign: "center" }}>{cart[b.id]}</span>
                      <button onClick={() => inc(b.id)} style={{ ...qtyBtn, background: P, color: "#1A1000", border: "none" }}><Plus size={15} /></button>
                    </div>
                  ) : (
                    <button onClick={() => inc(b.id)} style={{ ...qtyBtn, background: P, color: "#1A1000", border: "none", width: "auto", padding: "0 14px", fontWeight: 700, fontSize: 13 }}>Ajouter</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Barre panier fixe → ouvre la revue du panier */}
      {count > 0 && !showCart && (
        <motion.div initial={{ y: 60 }} animate={{ y: 0 }}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: `0.5px solid ${BORDER}`,
            padding: "12px 16px calc(env(safe-area-inset-bottom,0px) + 12px)", zIndex: 50 }}>
          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: MUTED }}>{count} article{count > 1 ? "s" : ""}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>{fmt(total)}</div>
            </div>
            <button onClick={() => setShowCart(true)}
              style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 8 }}>
              <ShoppingCart size={17} /> Voir le panier
            </button>
          </div>
        </motion.div>
      )}

      {/* Revue du panier (bottom sheet) */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.25 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: BG, borderRadius: "18px 18px 0 0",
                zIndex: 61, maxHeight: "85vh", display: "flex", flexDirection: "column", maxWidth: 640, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 8px" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: DARK }}>Votre panier</div>
                <button onClick={() => setShowCart(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: MUTED, padding: 4 }}><X size={22} /></button>
              </div>

              <div style={{ overflowY: "auto", padding: "0 18px", flex: 1 }}>
                {lines.length === 0 ? (
                  <div style={{ textAlign: "center", color: MUTED, padding: "40px 0", fontSize: 14 }}>Votre panier est vide.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {lines.map(l => (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "10px 12px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{l.name}</div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: P }}>{fmt(l.price)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button onClick={() => dec(l.id)} style={qtyBtn}><Minus size={15} /></button>
                          <span style={{ fontSize: 15, fontWeight: 700, color: DARK, minWidth: 16, textAlign: "center" }}>{l.qty}</span>
                          <button onClick={() => inc(l.id)} style={{ ...qtyBtn, background: P, color: "#1A1000", border: "none" }}><Plus size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {lines.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <input value={guest} onChange={e => setGuest(e.target.value)} placeholder="Votre nom (optionnel)" style={inp} />
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optionnel)" style={{ ...inp, marginTop: 8 }} />
                  </div>
                )}

                {submitErr && (
                  <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", color: "#DC2626", fontSize: 12.5, borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>{submitErr}</div>
                )}
              </div>

              <div style={{ padding: "12px 18px calc(env(safe-area-inset-bottom,0px) + 14px)", borderTop: `0.5px solid ${BORDER}`, background: "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: MUTED }}>{count} article{count > 1 ? "s" : ""}</div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: DARK }}>{fmt(total)}</div>
                  </div>
                  <button onClick={submit} disabled={submitting || !count}
                    style={{ ...primaryBtn, opacity: (!count || submitting) ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}>
                    <Check size={17} /> {submitting ? "Envoi…" : "Commander"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const Center = ({ children }) => (
  <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 14, fontFamily: FONT, padding: 24, textAlign: "center" }}>{children}</div>
);
const qtyBtn = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${BORDER}`, background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: DARK };
const inp = { width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, background: "white", outline: "none", fontFamily: FONT, boxSizing: "border-box", color: DARK };
const primaryBtn = { border: "none", borderRadius: 11, padding: "13px 22px", background: P, color: "#1A1000", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT };
const link = { marginTop: 14, border: "none", background: "transparent", color: P, fontWeight: 600, cursor: "pointer", fontFamily: FONT, fontSize: 13 };
