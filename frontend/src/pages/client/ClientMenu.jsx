import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Plus, Minus, CheckCircle, ChevronDown, ChevronUp,
  X, Clock, User, Phone, FileText, History, ArrowLeft,
} from "lucide-react";
import { menuService }        from "../../services/menu.service.js";
import { ordersService }      from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";

// Page mobile — scannée via QR code
// URL: /menu/:slug?table=T4

const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "—";

const STATUS_LABELS = {
  en_attente: "En attente",
  en_cours:   "En préparation",
  servi:      "Servi",
  annule:     "Annulé",
};
const STATUS_COLORS = {
  en_attente: "#C47D1A",
  en_cours:   "#2563EB",
  servi:      "#16A34A",
  annule:     "#DC2626",
};

// Sauvegarde les commandes de la session en localStorage
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

export default function ClientMenu() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const table = searchParams.get("table") || "";

  const [resto,       setResto]       = useState(null);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [cart,        setCart]        = useState({}); // { itemId: { item, qty, note, options:{} } }
  const [step,        setStep]        = useState("menu"); // menu | info | cart | confirm | error | history
  const [openCats,    setOpenCats]    = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [lastOrder,   setLastOrder]   = useState(null);
  const [localOrders, setLocalOrders] = useState([]);
  const [optionModal, setOptionModal] = useState(null); // { item }

  // Infos client
  const [clientName,  setClientName]  = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [orderNote,   setOrderNote]   = useState("");

  const G    = resto?.theme_color || "#E8A045";
  const GL   = G + "22";
  const DARK = "#1E2E28";
  const MUTED= "#9BA89F";
  const FONT = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      restaurantsService.getBySlug(slug),
      menuService.getPublicMenu(slug),
    ])
      .then(([restoData, menuData]) => {
        const r = restoData.restaurant || restoData;
        setResto(r);
        const cats = menuData.categories || menuData || [];
        setCategories(cats);
        if (cats.length > 0) setOpenCats({ [cats[0].id]: true });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    setLocalOrders(loadLocalOrders());
  }, [slug]);

  // ── Cart helpers ──
  const cartItems  = Object.values(cart);
  const cartCount  = cartItems.reduce((a, c) => a + c.qty, 0);
  const cartTotal  = cartItems.reduce((a, c) => a + c.item.price * c.qty, 0);

  const addItem = (item) =>
    setCart(p => ({
      ...p,
      [item.id]: { item, qty: (p[item.id]?.qty || 0) + 1, note: p[item.id]?.note || "", options: p[item.id]?.options || {} },
    }));
  const removeItem = (id) =>
    setCart(p => {
      const qty = (p[id]?.qty || 0) - 1;
      if (qty <= 0) { const n = { ...p }; delete n[id]; return n; }
      return { ...p, [id]: { ...p[id], qty } };
    });
  const setItemNote = (id, note) =>
    setCart(p => ({ ...p, [id]: { ...p[id], note } }));
  const setItemOption = (id, key, val) =>
    setCart(p => ({ ...p, [id]: { ...p[id], options: { ...(p[id]?.options || {}), [key]: val } } }));

  const toggleCat = (id) => setOpenCats(p => ({ ...p, [id]: !p[id] }));

  // ── Passer la commande ──
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
        id:          result?.order?.id || result?.id || String(Date.now()),
        status:      "en_attente",
        total:       cartTotal,
        items:       items,
        created_at:  new Date().toISOString(),
        table_label: table,
        client_name: clientName,
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

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "sans-serif", color: MUTED }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🍽️</div>
        <div>Chargement du menu…</div>
      </div>
    </div>
  );

  if (!resto) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "sans-serif", color: MUTED, padding: 24, textAlign: "center" }}>
      Menu introuvable
    </div>
  );

  // ── Confirmation ──
  if (step === "confirm") return (
    <div style={{ minHeight: "100vh", background: GL, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ textAlign: "center", background: "white", borderRadius: 20, padding: 32,
          maxWidth: 380, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.1)" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: G,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={34} color="white" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: DARK, marginBottom: 6 }}>Commande envoyée !</h2>
        {clientName && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Bonjour {clientName} 👋</div>}
        {table && <div style={{ fontSize: 13, color: G, fontWeight: 600, marginBottom: 4 }}>Table {table}</div>}
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 12 }}>
          Votre commande a été transmise à la cuisine.
        </p>
        <div style={{ background: GL, borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: DARK }}>
          <strong style={{ color: G }}>{fmt(cartTotal)}</strong> · {cartCount} article{cartCount > 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => { setCart({}); setClientName(""); setClientPhone(""); setOrderNote(""); setStep("menu"); }}
            style={{ padding: "12px 0", borderRadius: 10, border: "none",
              background: G, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
            Nouvelle commande
          </button>
          <button onClick={() => setStep("history")}
            style={{ padding: "12px 0", borderRadius: 10, border: `0.5px solid ${G}`,
              background: "white", color: G, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
            Voir mes commandes
          </button>
        </div>
      </motion.div>
    </div>
  );

  // ── Erreur ──
  if (step === "error") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <div style={{ textAlign: "center", background: "white", borderRadius: 20,
        padding: 32, maxWidth: 360, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.1)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: "#DC2626", marginBottom: 16 }}>{errorMsg}</div>
        <button onClick={() => setStep("cart")}
          style={{ padding: "10px 24px", borderRadius: 10, border: "none",
            background: G, color: "white", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: FONT }}>
          Retour au panier
        </button>
      </div>
    </div>
  );

  // ── Historique des commandes ──
  if (step === "history") return (
    <div style={{ minHeight: "100vh", background: "#fafafa", maxWidth: 440, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ background: G, padding: "20px 16px 16px" }}>
        <button onClick={() => setStep("menu")} style={{ background: "transparent", border: "none",
          color: "rgba(255,255,255,.85)", fontSize: 13, cursor: "pointer", marginBottom: 6, padding: 0,
          display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Retour au menu
        </button>
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Mes commandes</h2>
        {table && <p style={{ color: "rgba(255,255,255,.7)", fontSize: 12, margin: "2px 0 0" }}>Table {table}</p>}
      </div>
      <div style={{ padding: "16px" }}>
        {localOrders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>
            <History size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
            <div style={{ fontSize: 13 }}>Aucune commande dans cette session</div>
          </div>
        ) : localOrders.map((o, i) => (
          <div key={i} style={{ background: "white", borderRadius: 12, padding: 16,
            marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: MUTED }}>
                  {new Date(o.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                </div>
                {o.table_label && <div style={{ fontSize: 11, color: MUTED }}>Table {o.table_label}</div>}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                background: (STATUS_COLORS[o.status] || MUTED) + "22",
                color: STATUS_COLORS[o.status] || MUTED,
              }}>
                {STATUS_LABELS[o.status] || o.status}
              </span>
            </div>
            <div style={{ borderTop: "0.5px solid #f0f0f0", paddingTop: 10 }}>
              {(o.items || []).map((it, j) => (
                <div key={j} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: DARK, marginBottom: 4 }}>
                  <span>{it.qty}× {it.name}{it.note ? ` (${it.note})` : ""}</span>
                  <span style={{ color: MUTED }}>{fmt(it.price * it.qty)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between",
                fontWeight: 700, fontSize: 13, marginTop: 8, paddingTop: 8,
                borderTop: "0.5px solid #f0f0f0" }}>
                <span>Total</span>
                <span style={{ color: G }}>{fmt(o.total)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Infos client (avant paiement) ──
  if (step === "info") return (
    <div style={{ minHeight: "100vh", background: "#fafafa", maxWidth: 440, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ background: G, padding: "20px 16px 16px" }}>
        <button onClick={() => setStep("cart")} style={{ background: "transparent", border: "none",
          color: "rgba(255,255,255,.85)", fontSize: 13, cursor: "pointer", marginBottom: 6, padding: 0,
          display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Retour au panier
        </button>
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Vos informations</h2>
        {table && <p style={{ color: "rgba(255,255,255,.7)", fontSize: 12, margin: "2px 0 0" }}>Table {table}</p>}
      </div>
      <div style={{ padding: "24px 16px" }}>
        <div style={{ background: "white", borderRadius: 16, padding: 20,
          boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <User size={16} color={G} />
            <span style={{ fontSize: 14, fontWeight: 600, color: DARK }}>Nom complet *</span>
          </div>
          <input value={clientName} onChange={e => setClientName(e.target.value)}
            placeholder="Jean Kouassi"
            style={{ width: "100%", border: "0.5px solid #E4DFD8", borderRadius: 10,
              padding: "12px 14px", fontSize: 14, color: DARK, background: "#F8F5EF",
              outline: "none", fontFamily: FONT, boxSizing: "border-box" }} />
        </div>
        <div style={{ background: "white", borderRadius: 16, padding: 20,
          boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Phone size={16} color={G} />
            <span style={{ fontSize: 14, fontWeight: 600, color: DARK }}>Téléphone</span>
          </div>
          <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
            placeholder="+225 07 00 00 00 00" type="tel"
            style={{ width: "100%", border: "0.5px solid #E4DFD8", borderRadius: 10,
              padding: "12px 14px", fontSize: 14, color: DARK, background: "#F8F5EF",
              outline: "none", fontFamily: FONT, boxSizing: "border-box" }} />
        </div>
        <div style={{ background: "white", borderRadius: 16, padding: 20,
          boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <FileText size={16} color={G} />
            <span style={{ fontSize: 14, fontWeight: 600, color: DARK }}>Notes / allergies</span>
          </div>
          <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)}
            placeholder="Sans gluten, pas d'oignons, anniversaire…" rows={3}
            style={{ width: "100%", border: "0.5px solid #E4DFD8", borderRadius: 10,
              padding: "12px 14px", fontSize: 13, color: DARK, background: "#F8F5EF",
              outline: "none", fontFamily: FONT, resize: "none", boxSizing: "border-box" }} />
        </div>

        {/* Récap commande */}
        <div style={{ background: "white", borderRadius: 16, padding: 16,
          boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: DARK, marginBottom: 10 }}>Récapitulatif</div>
          {cartItems.map(({ item, qty, options, note }) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between",
              fontSize: 12, color: DARK, marginBottom: 5 }}>
              <span>{qty}× {item.name}
                {options?.cuisson ? ` — ${options.cuisson}` : ""}
                {note ? ` (${note})` : ""}
              </span>
              <span style={{ color: MUTED, flexShrink: 0, marginLeft: 8 }}>{fmt(item.price * qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between",
            fontWeight: 700, fontSize: 14, marginTop: 10, paddingTop: 10,
            borderTop: "0.5px solid #f0f0f0" }}>
            <span>Total</span>
            <span style={{ color: G }}>{fmt(cartTotal)}</span>
          </div>
        </div>

        <button onClick={placeOrder} disabled={submitting || !clientName.trim()}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
            background: (!clientName.trim() || submitting) ? MUTED : G,
            color: "white", fontSize: 15, fontWeight: 700, cursor: !clientName.trim() || submitting ? "not-allowed" : "pointer",
            fontFamily: FONT }}>
          {submitting ? "Envoi en cours…" : `Confirmer · ${fmt(cartTotal)}`}
        </button>
        {!clientName.trim() && (
          <p style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 8 }}>
            Le nom est requis pour valider la commande
          </p>
        )}
      </div>
    </div>
  );

  // ── Panier ──
  if (step === "cart") return (
    <div style={{ minHeight: "100vh", background: "#fff", maxWidth: 440, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ background: G, padding: "16px 16px 12px" }}>
        <button onClick={() => setStep("menu")} style={{ background: "transparent", border: "none",
          color: "rgba(255,255,255,.85)", fontSize: 13, cursor: "pointer", marginBottom: 6, padding: 0,
          display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Retour au menu
        </button>
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Mon panier</h2>
        {table && <p style={{ color: "rgba(255,255,255,.7)", fontSize: 12, margin: "2px 0 0" }}>Table {table}</p>}
      </div>

      <div style={{ padding: "16px 16px 120px" }}>
        {cartItems.map(({ item, qty, note, options }) => (
          <div key={item.id} style={{ borderBottom: "0.5px solid #f5f5f5", paddingBottom: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {item.image_url && (
                <img src={item.image_url} alt={item.name}
                  style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                  onError={e => { e.target.style.display = "none"; }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{item.name}</div>
                <div style={{ fontSize: 12, color: G, fontWeight: 600 }}>{fmt(item.price)}</div>
                {options?.cuisson && <div style={{ fontSize: 11, color: MUTED }}>Cuisson : {options.cuisson}</div>}
                {options?.accompagnement && <div style={{ fontSize: 11, color: MUTED }}>Avec : {options.accompagnement}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => removeItem(item.id)}
                  style={{ width: 28, height: 28, borderRadius: "50%",
                    border: `1px solid #e5e5e5`, background: "white",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Minus size={12} color={MUTED} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: DARK, minWidth: 16, textAlign: "center" }}>{qty}</span>
                <button onClick={() => addItem(item)}
                  style={{ width: 28, height: 28, borderRadius: "50%",
                    border: "none", background: G,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={12} color="white" />
                </button>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, minWidth: 60, textAlign: "right" }}>
                {fmt(item.price * qty)}
              </div>
            </div>
            {/* Note par article */}
            <input value={note || ""} onChange={e => setItemNote(item.id, e.target.value)}
              placeholder="Note (ex: sans oignons)"
              style={{ width: "100%", marginTop: 8, border: "0.5px solid #E4DFD8", borderRadius: 8,
                padding: "7px 10px", fontSize: 11, color: DARK, background: "#F8F5EF",
                outline: "none", fontFamily: FONT, boxSizing: "border-box" }} />
            {/* Options cuisson/accompagnement si définis */}
            {item.options && (() => {
              let opts = null;
              try { opts = typeof item.options === "string" ? JSON.parse(item.options) : item.options; } catch(_) {}
              if (!opts) return null;
              return (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {opts.cuissons?.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>Cuisson</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {opts.cuissons.map(c => (
                          <button key={c} onClick={() => setItemOption(item.id, "cuisson", c)}
                            style={{ padding: "4px 10px", borderRadius: 20, border: "none",
                              fontSize: 11, cursor: "pointer", fontFamily: FONT,
                              background: options?.cuisson === c ? G : "#f0f0f0",
                              color: options?.cuisson === c ? "white" : DARK }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {opts.accompagnements?.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>Accompagnement</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {opts.accompagnements.map(a => (
                          <button key={a} onClick={() => setItemOption(item.id, "accompagnement", a)}
                            style={{ padding: "4px 10px", borderRadius: 20, border: "none",
                              fontSize: 11, cursor: "pointer", fontFamily: FONT,
                              background: options?.accompagnement === a ? G : "#f0f0f0",
                              color: options?.accompagnement === a ? "white" : DARK }}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Sticky footer */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 440, background: "white",
        borderTop: "0.5px solid #f0f0f0", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 14 }}>
          <span style={{ color: MUTED }}>Total</span>
          <span style={{ fontWeight: 700, color: DARK }}>{fmt(cartTotal)}</span>
        </div>
        <button onClick={() => setStep("info")}
          style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
            background: G, color: "white", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: FONT }}>
          Continuer → Mes informations
        </button>
      </div>
    </div>
  );

  // ── Menu principal ──
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", maxWidth: 440,
      margin: "0 auto", fontFamily: FONT, paddingBottom: cartCount > 0 ? 90 : 20 }}>

      {/* Header */}
      <div style={{ background: G, padding: "20px 16px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {resto.logo_url && (
              <img src={resto.logo_url} alt={resto.name}
                style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }}
                onError={e => { e.target.style.display = "none"; }} />
            )}
            <div>
              <h1 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                {resto.name}
              </h1>
              {table && <div style={{ color: "rgba(255,255,255,.75)", fontSize: 12 }}>Table {table}</div>}
            </div>
          </div>
          {/* Historique */}
          {localOrders.length > 0 && (
            <button onClick={() => setStep("history")}
              style={{ background: "rgba(255,255,255,.2)", border: "none",
                borderRadius: 8, padding: "6px 10px", color: "white",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <History size={14} />
              Historique
            </button>
          )}
        </div>
      </div>

      {/* Catégories + plats */}
      <div style={{ padding: "8px 0" }}>
        {categories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 13 }}>
            Menu non disponible
          </div>
        ) : categories.map(cat => {
          const items = (cat.items || []).filter(i => i.is_active !== false && i.is_available !== false);
          if (items.length === 0) return null;
          const open = openCats[cat.id] !== false;
          return (
            <div key={cat.id} style={{ marginBottom: 4 }}>
              <button onClick={() => toggleCat(cat.id)}
                style={{ width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "space-between", padding: "12px 16px",
                  background: "white", border: "none", cursor: "pointer",
                  borderBottom: open ? `2px solid ${G}` : "none", fontFamily: FONT }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{cat.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{items.length} plat{items.length > 1 ? "s" : ""}</span>
                  {open ? <ChevronUp size={14} color={MUTED} /> : <ChevronDown size={14} color={MUTED} />}
                </div>
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: "hidden" }}>
                    {items.map(item => {
                      const inCart = cart[item.id]?.qty || 0;
                      return (
                        <div key={item.id}
                          style={{ display: "flex", gap: 12, padding: "12px 16px",
                            background: "white", borderBottom: "0.5px solid #f5f5f5" }}>
                          {item.image_url && (
                            <img src={item.image_url} alt={item.name}
                              style={{ width: 72, height: 72, borderRadius: 10,
                                objectFit: "cover", flexShrink: 0 }}
                              onError={e => { e.target.style.display = "none"; }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: DARK, marginBottom: 3 }}>
                              {item.name}
                            </div>
                            {item.description && (
                              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4, marginBottom: 6 }}>
                                {item.description}
                              </div>
                            )}
                            {/* Tags options */}
                            {item.options && (() => {
                              let opts = null;
                              try { opts = typeof item.options === "string" ? JSON.parse(item.options) : item.options; } catch(_) {}
                              if (!opts) return null;
                              const tags = [];
                              if (opts.cuissons?.length) tags.push("Cuisson au choix");
                              if (opts.accompagnements?.length) tags.push("Accompagnement inclus");
                              return tags.length > 0 ? (
                                <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
                                  {tags.map(t => (
                                    <span key={t} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20,
                                      background: GL, color: G, fontWeight: 600 }}>{t}</span>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                            <div style={{ fontSize: 14, fontWeight: 700, color: G }}>
                              {fmt(item.price)}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end",
                            flexDirection: "column", justifyContent: "flex-end", gap: 4, flexShrink: 0 }}>
                            {inCart > 0 ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <button onClick={() => removeItem(item.id)}
                                  style={{ width: 30, height: 30, borderRadius: "50%",
                                    border: `1.5px solid ${G}`, background: "white",
                                    cursor: "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center" }}>
                                  <Minus size={13} color={G} />
                                </button>
                                <span style={{ fontSize: 14, fontWeight: 700, color: G,
                                  minWidth: 16, textAlign: "center" }}>{inCart}</span>
                                <button onClick={() => addItem(item)}
                                  style={{ width: 30, height: 30, borderRadius: "50%",
                                    border: "none", background: G,
                                    cursor: "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center" }}>
                                  <Plus size={13} color="white" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => addItem(item)}
                                style={{ width: 30, height: 30, borderRadius: "50%",
                                  border: "none", background: G,
                                  cursor: "pointer", display: "flex",
                                  alignItems: "center", justifyContent: "center" }}>
                                <Plus size={14} color="white" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Sticky cart button */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
              width: "calc(100% - 32px)", maxWidth: 408, zIndex: 20 }}>
            <button onClick={() => setStep("cart")}
              style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "none",
                background: G, color: "white", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: FONT, display: "flex",
                alignItems: "center", justifyContent: "space-between",
                boxShadow: "0 4px 20px rgba(0,0,0,.2)" }}>
              <span style={{ background: "rgba(255,255,255,.25)", borderRadius: "50%",
                width: 26, height: 26, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                {cartCount}
              </span>
              <span>Voir mon panier</span>
              <span>{fmt(cartTotal)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
