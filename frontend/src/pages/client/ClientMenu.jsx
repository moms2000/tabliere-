/**
 * ClientMenu — Interface QR premium TablièreCI
 * Design plein écran, immersif, marque TablièreCI en fond
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Plus, Minus, CheckCircle, ChevronDown, ChevronUp,
  X, Clock, User, Phone, FileText, History, ArrowLeft, Check, AlertTriangle,
} from "lucide-react";
import { menuService }        from "../../services/menu.service.js";
import { ordersService }      from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";

const STORAGE_KEY = "tci_qr_orders";
const saveOrderLocally = (order) => {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    existing.unshift(order);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 20)));
  } catch (_) {}
};
const loadLocalOrders = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
};

const STATUS_LABELS = { en_attente: "En attente", en_cours: "En préparation", servi: "Servi", annule: "Annulé" };
const STATUS_COLORS = { en_attente: "#F59E0B", en_cours: "#3B82F6", servi: "#10B981", annule: "#EF4444" };

const fmt = (n) => n ? Number(n).toLocaleString("fr-CI") + " F" : "—";

/* ── Logo TablièreCI SVG ──────────────────────────────────────────────────── */
function TCI({ size = 22, color = "white" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={color} fillOpacity="0.15" />
      <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill={color} />
      <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill={color} />
      <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
        stroke={color} strokeWidth="1.3" strokeOpacity="0.5" fill="none" />
    </svg>
  );
}

/* ── Fond décoratif TablièreCI ─────────────────────────────────────────────── */
function TCIWatermark({ color }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Cercles décoratifs */}
      <div style={{ position: "absolute", top: -120, right: -80, width: 400, height: 400,
        borderRadius: "50%", background: color, opacity: 0.06 }} />
      <div style={{ position: "absolute", bottom: -100, left: -60, width: 300, height: 300,
        borderRadius: "50%", background: color, opacity: 0.05 }} />
      {/* Motif wax ivoirien */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.03 }}
        viewBox="0 0 400 800" fill="none">
        {[0,1,2,3].map(row => [0,1,2].map(col => (
          <g key={`${row}-${col}`} transform={`translate(${col * 140 - 20},${row * 200 - 20})`}>
            <circle cx="60" cy="60" r="40" fill={color} />
            <circle cx="60" cy="60" r="24" fill="white" />
            <circle cx="60" cy="60" r="10" fill={color} />
          </g>
        )))}
      </svg>
      {/* Logo TablièreCI en filigramme */}
      <div style={{ position: "absolute", bottom: 80, right: 20, opacity: 0.07, fontSize: 11,
        color, fontWeight: 900, letterSpacing: "3px", textTransform: "uppercase",
        writingMode: "vertical-rl", fontFamily: "'Avenir Next', sans-serif" }}>
        TABLIÈRECI
      </div>
    </div>
  );
}

export default function ClientMenu() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const table = searchParams.get("table") || "";

  const [resto,       setResto]       = useState(null);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [cart,        setCart]        = useState({});
  const [step,        setStep]        = useState("menu");
  const [openCats,    setOpenCats]    = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [lastOrder,   setLastOrder]   = useState(null);
  const [localOrders, setLocalOrders] = useState([]);
  const [activeCat,   setActiveCat]   = useState(null);
  const catRefs = useRef({});

  // Infos client
  const [clientName,  setClientName]  = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [orderNote,   setOrderNote]   = useState("");
  const [agreed,      setAgreed]      = useState(false); // case obligatoire

  const G    = resto?.theme_color || "#1D9E75";
  const GL   = G + "18";
  const DARK = "#0D1B18";
  const MUTED= "rgba(255,255,255,0.55)";
  const FONT = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";
  const BG   = "#0D1B18"; // fond sombre premium

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      restaurantsService.getBySlug(slug),
      menuService.getPublicMenu(slug),
    ]).then(([restoData, menuData]) => {
      const r = restoData.restaurant || restoData;
      setResto(r);
      const cats = menuData.categories || menuData || [];
      setCategories(cats);
      if (cats.length > 0) { setOpenCats({ [cats[0].id]: true }); setActiveCat(cats[0].id); }
    }).catch(console.error).finally(() => setLoading(false));
    setLocalOrders(loadLocalOrders());
  }, [slug]);

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((a, c) => a + c.qty, 0);
  const cartTotal = cartItems.reduce((a, c) => a + c.item.price * c.qty, 0);

  const addItem = (item) =>
    setCart(p => ({ ...p, [item.id]: { item, qty: (p[item.id]?.qty || 0) + 1, note: p[item.id]?.note || "", options: p[item.id]?.options || {} } }));
  const removeItem = (id) =>
    setCart(p => { const qty = (p[id]?.qty || 0) - 1; if (qty <= 0) { const n = {...p}; delete n[id]; return n; } return { ...p, [id]: {...p[id], qty} }; });
  const setItemNote = (id, note) => setCart(p => ({ ...p, [id]: { ...p[id], note } }));
  const setItemOption = (id, key, val) =>
    setCart(p => ({ ...p, [id]: { ...p[id], options: { ...(p[id]?.options || {}), [key]: val } } }));

  const scrollToCat = (catId) => {
    setActiveCat(catId);
    catRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const placeOrder = async () => {
    if (!resto) return;
    setSubmitting(true); setErrorMsg("");
    try {
      const items = cartItems.map(({ item, qty, note, options }) => ({
        id: item.id, name: item.name, price: item.price, qty,
        note: note || undefined,
        options: Object.keys(options || {}).length > 0 ? options : undefined,
      }));
      const result = await ordersService.create({
        restaurant_id: resto.id,
        table_label:   table || undefined,
        client_name:   clientName || undefined,
        client_phone:  clientPhone || undefined,
        note:          orderNote || undefined,
        items,
        total: cartTotal,
      });
      const newOrder = {
        id: result?.order?.id || String(Date.now()),
        status: "en_attente", total: cartTotal, items,
        created_at: new Date().toISOString(), table_label: table, client_name: clientName,
      };
      setLastOrder(newOrder);
      saveOrderLocally(newOrder);
      setLocalOrders(loadLocalOrders());
      setStep("confirm");
    } catch (e) {
      setErrorMsg(e.response?.data?.message || "Impossible d'envoyer la commande. Réessayez.");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: "100vh", background: DARK, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: FONT }}>
      <div style={{ textAlign: "center" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{ width: 40, height: 40, border: `3px solid rgba(255,255,255,.1)`,
            borderTopColor: G, borderRadius: "50%", margin: "0 auto 16px" }} />
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13 }}>Chargement du menu…</div>
      </div>
    </div>
  );

  if (!resto) return (
    <div style={{ minHeight: "100vh", background: DARK, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: FONT, color: "rgba(255,255,255,.5)", padding: 24, textAlign: "center" }}>
      Menu introuvable
    </div>
  );

  /* ── Confirmation ── */
  if (step === "confirm") return (
    <div style={{ minHeight: "100vh", background: DARK, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT }}>
      <TCIWatermark color={G} />
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{ textAlign: "center", background: "rgba(255,255,255,.06)",
          backdropFilter: "blur(20px)", borderRadius: 24, padding: 32,
          maxWidth: 380, width: "100%", border: "0.5px solid rgba(255,255,255,.1)",
          position: "relative", zIndex: 1 }}>
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, delay: 0.2 }}
          style={{ width: 72, height: 72, borderRadius: "50%", background: G,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <CheckCircle size={38} color="white" />
        </motion.div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "white", marginBottom: 6 }}>Commande envoyée !</h2>
        {clientName && <div style={{ fontSize: 14, color: MUTED, marginBottom: 4 }}>Bonjour {clientName} 👋</div>}
        {table && <div style={{ fontSize: 13, color: G, fontWeight: 700, marginBottom: 4 }}>Table {table}</div>}
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 16 }}>
          Votre commande a été transmise à la cuisine.<br />
          Merci de votre confiance.
        </p>
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: "12px 16px",
          marginBottom: 24, fontSize: 13, color: "white" }}>
          <strong style={{ color: G }}>{fmt(cartTotal)}</strong>
          <span style={{ color: MUTED }}> · {cartCount} article{cartCount > 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => { setCart({}); setClientName(""); setClientPhone(""); setOrderNote(""); setAgreed(false); setStep("menu"); }}
            style={{ padding: "13px 0", borderRadius: 12, border: "none",
              background: G, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            Nouvelle commande
          </button>
          <button onClick={() => setStep("history")}
            style={{ padding: "13px 0", borderRadius: 12, border: `0.5px solid rgba(255,255,255,.15)`,
              background: "transparent", color: "rgba(255,255,255,.7)", fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
            Voir mes commandes
          </button>
        </div>
      </motion.div>
    </div>
  );

  /* ── Erreur ── */
  if (step === "error") return (
    <div style={{ minHeight: "100vh", background: DARK, display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <TCIWatermark color={G} />
      <div style={{ textAlign: "center", background: "rgba(255,255,255,.06)", borderRadius: 20,
        padding: 32, maxWidth: 360, width: "100%", position: "relative", zIndex: 1,
        border: "0.5px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: "#FCA5A5", marginBottom: 16 }}>{errorMsg}</div>
        <button onClick={() => setStep("cart")}
          style={{ padding: "11px 24px", borderRadius: 10, border: "none",
            background: G, color: "white", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: FONT }}>
          Retour au panier
        </button>
      </div>
    </div>
  );

  /* ── Historique ── */
  if (step === "history") return (
    <div style={{ minHeight: "100vh", background: DARK, maxWidth: 480, margin: "0 auto", fontFamily: FONT }}>
      <TCIWatermark color={G} />
      <div style={{ background: G, padding: "20px 16px 16px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <TCI size={24} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.7)",
            letterSpacing: "2px", textTransform: "uppercase" }}>TablièreCI</span>
        </div>
        <button onClick={() => setStep("menu")} style={{ background: "rgba(255,255,255,.15)",
          border: "none", color: "white", fontSize: 13, cursor: "pointer",
          marginBottom: 8, padding: "5px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={13} /> Retour au menu
        </button>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: 0 }}>Mes commandes</h2>
        {table && <p style={{ color: "rgba(255,255,255,.65)", fontSize: 12, margin: "3px 0 0" }}>Table {table}</p>}
      </div>
      <div style={{ padding: "16px", position: "relative", zIndex: 1 }}>
        {localOrders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "rgba(255,255,255,.3)" }}>
            <History size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>Aucune commande dans cette session</div>
          </div>
        ) : localOrders.map((o, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: 16,
              marginBottom: 12, border: "0.5px solid rgba(255,255,255,.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>
                  {new Date(o.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                </div>
                {o.table_label && <div style={{ fontSize: 11, color: MUTED }}>Table {o.table_label}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: (STATUS_COLORS[o.status] || "#888") + "28",
                color: STATUS_COLORS[o.status] || "#aaa", border: `0.5px solid ${STATUS_COLORS[o.status] || "#888"}44` }}>
                {STATUS_LABELS[o.status] || o.status}
              </span>
            </div>
            <div style={{ borderTop: "0.5px solid rgba(255,255,255,.06)", paddingTop: 10 }}>
              {(o.items || []).map((it, j) => (
                <div key={j} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: "rgba(255,255,255,.7)", marginBottom: 4 }}>
                  <span>{it.qty}× {it.name}</span>
                  <span style={{ color: MUTED }}>{fmt(it.price * it.qty)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between",
                fontWeight: 700, fontSize: 14, marginTop: 8, paddingTop: 8,
                borderTop: "0.5px solid rgba(255,255,255,.06)" }}>
                <span style={{ color: "rgba(255,255,255,.7)" }}>Total</span>
                <span style={{ color: G }}>{fmt(o.total)}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  /* ── Infos client ── */
  if (step === "info") return (
    <div style={{ minHeight: "100vh", background: DARK, maxWidth: 480, margin: "0 auto", fontFamily: FONT }}>
      <TCIWatermark color={G} />

      {/* Header */}
      <div style={{ background: G, padding: "20px 16px 20px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <TCI size={22} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.65)",
            letterSpacing: "2px", textTransform: "uppercase" }}>TablièreCI</span>
        </div>
        <button onClick={() => setStep("cart")} style={{ background: "rgba(255,255,255,.15)",
          border: "none", color: "white", fontSize: 12, cursor: "pointer",
          marginBottom: 10, padding: "5px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={12} /> Retour au panier
        </button>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: 0 }}>Vos informations</h2>
        {table && <p style={{ color: "rgba(255,255,255,.65)", fontSize: 12, margin: "3px 0 0" }}>Table {table}</p>}
      </div>

      <div style={{ padding: "20px 16px 120px", position: "relative", zIndex: 1 }}>
        {/* Nom */}
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: "16px 18px",
          marginBottom: 12, border: "0.5px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <User size={15} color={G} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Nom complet *</span>
          </div>
          <input value={clientName} onChange={e => setClientName(e.target.value)}
            placeholder="Jean Kouassi"
            style={{ width: "100%", background: "rgba(255,255,255,.08)", border: `0.5px solid ${clientName ? G+"88" : "rgba(255,255,255,.12)"}`,
              borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "white",
              outline: "none", fontFamily: FONT, boxSizing: "border-box" }} />
        </div>

        {/* Téléphone */}
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: "16px 18px",
          marginBottom: 12, border: "0.5px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Phone size={15} color={G} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Téléphone</span>
          </div>
          <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
            placeholder="+225 07 00 00 00 00" type="tel"
            style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "0.5px solid rgba(255,255,255,.12)",
              borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "white",
              outline: "none", fontFamily: FONT, boxSizing: "border-box" }} />
        </div>

        {/* Notes */}
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: "16px 18px",
          marginBottom: 16, border: "0.5px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <FileText size={15} color={G} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Notes / allergies</span>
          </div>
          <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)}
            placeholder="Sans gluten, pas d'oignons, anniversaire…" rows={3}
            style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "0.5px solid rgba(255,255,255,.12)",
              borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "white",
              outline: "none", fontFamily: FONT, resize: "none", boxSizing: "border-box" }} />
        </div>

        {/* Récapitulatif */}
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: "16px 18px",
          marginBottom: 20, border: "0.5px solid rgba(255,255,255,.08)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "white", marginBottom: 12 }}>
            Récapitulatif
          </div>
          {cartItems.map(({ item, qty, options, note }) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between",
              fontSize: 12, color: "rgba(255,255,255,.7)", marginBottom: 6 }}>
              <span>{qty}× {item.name}
                {options?.cuisson ? ` — ${options.cuisson}` : ""}
                {note ? ` (${note})` : ""}
              </span>
              <span style={{ color: G, flexShrink: 0, marginLeft: 8, fontWeight: 600 }}>{fmt(item.price * qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800,
            fontSize: 16, marginTop: 12, paddingTop: 12, borderTop: "0.5px solid rgba(255,255,255,.08)" }}>
            <span style={{ color: "rgba(255,255,255,.8)" }}>Total</span>
            <span style={{ color: G }}>{fmt(cartTotal)}</span>
          </div>
        </div>

        {/* ── Case à cocher OBLIGATOIRE ── */}
        <motion.div
          animate={{ borderColor: agreed ? G : "rgba(255,255,255,.15)" }}
          style={{ background: agreed ? G + "12" : "rgba(255,255,255,.04)",
            borderRadius: 14, padding: "14px 16px", marginBottom: 20,
            border: `1.5px solid ${agreed ? G : "rgba(255,255,255,.15)"}`,
            cursor: "pointer", transition: "all .2s" }}
          onClick={() => setAgreed(p => !p)}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <motion.div animate={{ background: agreed ? G : "rgba(255,255,255,.08)", scale: agreed ? [1.2, 1] : 1 }}
              style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${agreed ? G : "rgba(255,255,255,.3)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {agreed && <Check size={13} color="white" strokeWidth={3} />}
            </motion.div>
            <div style={{ fontSize: 12, color: agreed ? "white" : "rgba(255,255,255,.55)", lineHeight: 1.6 }}>
              <strong style={{ color: agreed ? G : "rgba(255,255,255,.7)" }}>J'ai vérifié ma commande et je m'engage à la régler en totalité.</strong>
              {" "}En cas d'erreur de ma part sur les articles commandés, j'en suis entièrement responsable.
            </div>
          </div>
          {!agreed && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8,
              fontSize: 10, color: "rgba(255,165,0,.8)", paddingLeft: 34 }}>
              <AlertTriangle size={10} /> Obligatoire pour valider la commande
            </div>
          )}
        </motion.div>
      </div>

      {/* Bouton fixe bas */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, padding: "12px 16px 28px",
        background: "linear-gradient(to top, " + DARK + " 70%, transparent)",
        zIndex: 10 }}>
        <motion.button
          whileTap={{ scale: agreed && clientName.trim() ? 0.97 : 1 }}
          onClick={agreed && clientName.trim() ? placeOrder : undefined}
          disabled={submitting || !clientName.trim() || !agreed}
          animate={{ opacity: agreed && clientName.trim() ? 1 : 0.5 }}
          style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none",
            background: agreed && clientName.trim() ? G : "rgba(255,255,255,.12)",
            color: agreed && clientName.trim() ? "white" : "rgba(255,255,255,.4)",
            fontSize: 16, fontWeight: 800, cursor: agreed && clientName.trim() ? "pointer" : "not-allowed",
            fontFamily: FONT }}>
          {submitting ? "Envoi en cours…" : `Confirmer · ${fmt(cartTotal)}`}
        </motion.button>
        {!clientName.trim() && (
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,.3)", marginTop: 6 }}>
            Le nom est requis
          </p>
        )}
      </div>
    </div>
  );

  /* ── Panier ── */
  if (step === "cart") return (
    <div style={{ minHeight: "100vh", background: DARK, maxWidth: 480, margin: "0 auto", fontFamily: FONT }}>
      <TCIWatermark color={G} />

      <div style={{ background: G, padding: "16px 16px 14px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <TCI size={20} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.65)",
            letterSpacing: "2px", textTransform: "uppercase" }}>TablièreCI</span>
        </div>
        <button onClick={() => setStep("menu")} style={{ background: "rgba(255,255,255,.15)",
          border: "none", color: "white", fontSize: 12, cursor: "pointer",
          marginBottom: 8, padding: "5px 12px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={12} /> Retour au menu
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: 0 }}>Mon panier</h2>
          {table && <span style={{ color: "rgba(255,255,255,.65)", fontSize: 12 }}>Table {table}</span>}
        </div>
      </div>

      <div style={{ padding: "16px 16px 140px", position: "relative", zIndex: 1 }}>
        {cartItems.map(({ item, qty, note, options }) => (
          <motion.div key={item.id} layout
            style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: "14px 14px",
              marginBottom: 12, border: "0.5px solid rgba(255,255,255,.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {item.image_url && (
                <img src={item.image_url} alt={item.name}
                  style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                  onError={e => { e.target.style.display = "none"; }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{item.name}</div>
                <div style={{ fontSize: 13, color: G, fontWeight: 700, marginTop: 2 }}>{fmt(item.price)}</div>
                {options?.cuisson && <div style={{ fontSize: 11, color: MUTED }}>Cuisson : {options.cuisson}</div>}
                {options?.accompagnement && <div style={{ fontSize: 11, color: MUTED }}>Avec : {options.accompagnement}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => removeItem(item.id)}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid rgba(255,255,255,.2)",
                    background: "rgba(255,255,255,.08)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Minus size={13} color="rgba(255,255,255,.7)" />
                </button>
                <span style={{ fontSize: 16, fontWeight: 800, color: "white", minWidth: 20, textAlign: "center" }}>{qty}</span>
                <button onClick={() => addItem(item)}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none",
                    background: G, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={13} color="white" />
                </button>
              </div>
            </div>

            {/* Note par article */}
            <input value={note || ""} onChange={e => setItemNote(item.id, e.target.value)}
              placeholder="Note (ex : sans oignons)"
              style={{ width: "100%", marginTop: 10, background: "rgba(255,255,255,.06)",
                border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 8,
                padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,.7)",
                outline: "none", fontFamily: FONT, boxSizing: "border-box" }} />

            {/* Options cuisson/accompagnement */}
            {item.options && (() => {
              let opts = null;
              try { opts = typeof item.options === "string" ? JSON.parse(item.options) : item.options; } catch(_) {}
              if (!opts) return null;
              return (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {opts.cuissons?.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 5 }}>Cuisson</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {opts.cuissons.map(c => (
                          <button key={c} onClick={() => setItemOption(item.id, "cuisson", c)}
                            style={{ padding: "4px 10px", borderRadius: 20, border: "none",
                              fontSize: 11, cursor: "pointer",
                              background: options?.cuisson === c ? G : "rgba(255,255,255,.1)",
                              color: options?.cuisson === c ? "white" : "rgba(255,255,255,.6)" }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {opts.accompagnements?.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 5 }}>Accompagnement</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {opts.accompagnements.map(a => (
                          <button key={a} onClick={() => setItemOption(item.id, "accompagnement", a)}
                            style={{ padding: "4px 10px", borderRadius: 20, border: "none",
                              fontSize: 11, cursor: "pointer",
                              background: options?.accompagnement === a ? G : "rgba(255,255,255,.1)",
                              color: options?.accompagnement === a ? "white" : "rgba(255,255,255,.6)" }}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        ))}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, padding: "12px 16px 28px",
        background: "linear-gradient(to top, " + DARK + " 60%, transparent)", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, padding: "0 4px" }}>
          <span style={{ color: MUTED, fontSize: 14 }}>Total</span>
          <span style={{ fontWeight: 800, color: "white", fontSize: 18 }}>{fmt(cartTotal)}</span>
        </div>
        <button onClick={() => setStep("info")}
          style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none",
            background: G, color: "white", fontSize: 16, fontWeight: 800,
            cursor: "pointer", fontFamily: FONT }}>
          Continuer → Mes informations
        </button>
      </div>
    </div>
  );

  /* ── Menu principal ── */
  return (
    <div style={{ minHeight: "100vh", background: DARK, maxWidth: 480, margin: "0 auto",
      fontFamily: FONT, paddingBottom: cartCount > 0 ? 100 : 24, position: "relative" }}>
      <TCIWatermark color={G} />

      {/* ── Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20,
        background: G, boxShadow: "0 4px 24px rgba(0,0,0,.3)" }}>
        <div style={{ padding: "16px 16px 0" }}>
          {/* Branding TablièreCI */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TCI size={20} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)",
                letterSpacing: "2px", textTransform: "uppercase" }}>TablièreCI</span>
            </div>
            {localOrders.length > 0 && (
              <button onClick={() => setStep("history")}
                style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 20,
                  padding: "5px 12px", color: "white", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <History size={13} />Historique
              </button>
            )}
          </div>

          {/* Nom du restaurant */}
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 900, margin: "0 0 4px",
            textShadow: "0 2px 10px rgba(0,0,0,.2)" }}>
            {resto.name}
          </h1>
          {table && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 14,
              background: "rgba(255,255,255,.2)", borderRadius: 20, padding: "3px 10px" }}>
              <span style={{ fontSize: 11, color: "white", fontWeight: 700 }}>Table {table}</span>
            </div>
          )}
          {!table && <div style={{ marginBottom: 14 }} />}
        </div>

        {/* Tabs catégories */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto",
          padding: "0 12px", scrollbarWidth: "none" }}>
          {categories.map(cat => {
            const items = (cat.items || []).filter(i => i.is_active !== false);
            if (items.length === 0) return null;
            const isActive = activeCat === cat.id;
            return (
              <button key={cat.id} onClick={() => scrollToCat(cat.id)}
                style={{ padding: "10px 16px", border: "none", cursor: "pointer",
                  background: "transparent", color: isActive ? "white" : "rgba(255,255,255,.55)",
                  fontWeight: isActive ? 700 : 500, fontSize: 13, whiteSpace: "nowrap",
                  borderBottom: isActive ? "2.5px solid white" : "2.5px solid transparent",
                  transition: "all .15s", fontFamily: FONT }}>
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenu ── */}
      <div style={{ padding: "8px 0", position: "relative", zIndex: 1 }}>
        {categories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontSize: 14 }}>
            Menu non disponible
          </div>
        ) : categories.map(cat => {
          const items = (cat.items || []).filter(i => i.is_active !== false && i.is_available !== false);
          if (items.length === 0) return null;
          return (
            <div key={cat.id} ref={el => { catRefs.current[cat.id] = el; }}
              style={{ marginBottom: 8 }}>
              {/* Titre catégorie */}
              <div style={{ padding: "14px 16px 10px", fontSize: 13, fontWeight: 800,
                color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: "1.5px" }}>
                {cat.name} <span style={{ fontSize: 11, opacity: 0.6 }}>({items.length})</span>
              </div>

              {/* Grille plats */}
              {items.map(item => {
                const inCart = cart[item.id]?.qty || 0;
                const opts = (() => {
                  try { return typeof item.options === "string" ? JSON.parse(item.options) : item.options; } catch { return null; }
                })();
                return (
                  <div key={item.id}
                    style={{ display: "flex", gap: 12, padding: "12px 16px",
                      borderBottom: "0.5px solid rgba(255,255,255,.04)",
                      background: inCart > 0 ? G + "08" : "transparent",
                      transition: "background .2s" }}>

                    {/* Image */}
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name}
                        style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover",
                          flexShrink: 0, border: `1.5px solid ${inCart > 0 ? G + "60" : "rgba(255,255,255,.08)"}` }}
                        onError={e => { e.target.style.display = "none"; }} />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: 12, flexShrink: 0,
                        background: "rgba(255,255,255,.05)", display: "flex",
                        alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                        🍽️
                      </div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 3 }}>
                        {item.name}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", lineHeight: 1.4, marginBottom: 5 }}>
                          {item.description}
                        </div>
                      )}

                      {/* Tags options */}
                      {opts && (opts.cuissons?.length > 0 || opts.accompagnements?.length > 0) && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                          {opts.cuissons?.length > 0 && (
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10,
                              background: G + "25", color: G, fontWeight: 700 }}>
                              Cuisson au choix
                            </span>
                          )}
                          {opts.accompagnements?.length > 0 && (
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10,
                              background: G + "25", color: G, fontWeight: 700 }}>
                              Accompagnement
                            </span>
                          )}
                        </div>
                      )}

                      <div style={{ fontSize: 15, fontWeight: 800, color: G }}>{fmt(item.price)}</div>
                    </div>

                    {/* Boutons +/- */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end",
                      justifyContent: "flex-end", flexShrink: 0 }}>
                      {inCart > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={() => removeItem(item.id)}
                            style={{ width: 32, height: 32, borderRadius: "50%",
                              border: `1.5px solid rgba(255,255,255,.2)`, background: "rgba(255,255,255,.08)",
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Minus size={13} color="rgba(255,255,255,.8)" />
                          </button>
                          <motion.span key={inCart} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                            style={{ fontSize: 16, fontWeight: 900, color: G, minWidth: 18, textAlign: "center" }}>
                            {inCart}
                          </motion.span>
                          <button onClick={() => addItem(item)}
                            style={{ width: 32, height: 32, borderRadius: "50%",
                              border: "none", background: G, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: `0 4px 12px ${G}60` }}>
                            <Plus size={13} color="white" />
                          </button>
                        </div>
                      ) : (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => addItem(item)}
                          style={{ width: 36, height: 36, borderRadius: "50%",
                            border: "none", background: G, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: `0 4px 16px ${G}60` }}>
                          <Plus size={16} color="white" />
                        </motion.button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Bouton panier flottant ── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
              width: "calc(100% - 32px)", maxWidth: 448, zIndex: 30 }}>
            <button onClick={() => setStep("cart")}
              style={{ width: "100%", padding: "16px 20px", borderRadius: 18, border: "none",
                background: G, color: "white", fontSize: 15, fontWeight: 800,
                cursor: "pointer", fontFamily: FONT, display: "flex",
                alignItems: "center", justifyContent: "space-between",
                boxShadow: `0 8px 32px ${G}60` }}>
              <span style={{ background: "rgba(255,255,255,.25)", borderRadius: "50%",
                width: 28, height: 28, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 13, fontWeight: 900 }}>
                {cartCount}
              </span>
              <span>Voir mon panier</span>
              <span style={{ fontWeight: 900 }}>{fmt(cartTotal)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
