/**
 * RestPOS — Interface service rapide pour serveurs
 * Catégorie → Plats → Panier → Envoyer en cuisine
 * Optimisé pour tablette / mobile en salle
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Trash2, Send, Zap, RefreshCw, CheckCircle, X, ChevronDown } from "lucide-react";
import { menuService }   from "../../services/menu.service.js";
import { ordersService } from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth }        from "../../context/AuthContext.jsx";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "—";

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 900);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

/* ── Carte produit ──────────────────────────────────────────────────────────── */
function ProductCard({ item, qty, onAdd, onRemove, color }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onAdd}
      style={{ background: "white", borderRadius: 12, overflow: "hidden", cursor: "pointer",
        border: `1.5px solid ${qty > 0 ? color : BORDER}`,
        boxShadow: qty > 0 ? `0 0 0 3px ${color}18` : "none",
        transition: "border .15s, box-shadow .15s",
        display: "flex", flexDirection: "column", position: "relative" }}>

      {/* Badge quantité */}
      <AnimatePresence>
        {qty > 0 && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            style={{ position: "absolute", top: 8, right: 8, zIndex: 2,
              width: 24, height: 24, borderRadius: "50%", background: color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: "white",
              boxShadow: `0 2px 8px ${color}55` }}>
            {qty}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image ou placeholder */}
      {item.image_url ? (
        <img src={item.image_url} alt={item.name}
          style={{ width: "100%", height: 100, objectFit: "cover", flexShrink: 0 }}
          onError={e => { e.target.style.display = "none"; }} />
      ) : (
        <div style={{ height: 72, background: qty > 0 ? color + "18" : BG,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .15s", fontSize: 24 }}>
          🍽️
        </div>
      )}

      {/* Infos */}
      <div style={{ padding: "8px 10px 10px", flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DARK, lineHeight: 1.3, marginBottom: 4 }}>
          {item.name}
        </div>
        {item.description && (
          <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4, marginBottom: 4,
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {item.description}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: color }}>{fmt(item.price)}</div>
      </div>

      {/* Contrôles +/- si en panier */}
      {qty > 0 && (
        <div onClick={e => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 10px", borderTop: `0.5px solid ${BORDER}`, background: color + "08" }}>
          <button onClick={onRemove}
            style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${BORDER}`,
              background: "white", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
            <Minus size={12} color={MUTED} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{qty}</span>
          <button onClick={onAdd}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none",
              background: color, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
            <Plus size={12} color="white" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ── Composant principal ──────────────────────────────────────────────────────── */
export default function RestPOS() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [categories,  setCategories]  = useState([]);
  const [tables,      setTables]      = useState([]);
  const [activeCat,   setActiveCat]   = useState(null);
  const [cart,        setCart]        = useState({});   // { itemId: { item, qty } }
  const [tableLabel,  setTableLabel]  = useState("");
  const [clientName,  setClientName]  = useState("");
  const [orderNote,   setOrderNote]   = useState("");
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [lastOrder,   setLastOrder]   = useState(null);
  const [showCart,    setShowCart]    = useState(false); // mobile: show cart panel
  const [error,       setError]       = useState("");
  const [showNote,    setShowNote]    = useState(false);

  const restoSlug = user?.resto_slug;
  const restoId   = user?.resto_id;

  // Couleurs par catégorie (cycle)
  const CAT_COLORS = [P, S, "#185FA5", "#7C3AED", "#DC2626", "#0D9488"];
  const catColor = (i) => CAT_COLORS[i % CAT_COLORS.length];

  useEffect(() => {
    if (!restoSlug || !restoId) { setLoading(false); return; }
    Promise.all([
      menuService.getFullMenu(restoSlug),
      restaurantsService.getManage(restoId),
    ]).then(([menuData, restoData]) => {
      const cats = (menuData.categories || []).filter(c => c.is_active !== false);
      setCategories(cats);
      if (cats.length > 0) setActiveCat(cats[0].id);
      setTables(restoData.restaurant?.tables || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [restoSlug, restoId]);

  // ── Panier ──
  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((s, { qty }) => s + qty, 0);
  const cartTotal = cartItems.reduce((s, { item, qty }) => s + item.price * qty, 0);

  const addItem = useCallback((item) =>
    setCart(p => ({ ...p, [item.id]: { item, qty: (p[item.id]?.qty || 0) + 1 } })), []);
  const removeItem = useCallback((id) =>
    setCart(p => {
      const qty = (p[id]?.qty || 0) - 1;
      if (qty <= 0) { const n = { ...p }; delete n[id]; return n; }
      return { ...p, [id]: { ...p[id], qty } };
    }), []);
  const clearCart = () => { setCart({}); setClientName(""); setOrderNote(""); setTableLabel(""); setLastOrder(null); setError(""); };

  // ── Envoyer en cuisine ──
  const sendOrder = async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true); setError("");
    try {
      const items = cartItems.map(({ item, qty }) => ({ id: item.id, name: item.name, price: item.price, qty }));
      const result = await ordersService.createManual({
        table_label:  tableLabel  || undefined,
        client_name:  clientName  || undefined,
        note:         orderNote   || undefined,
        items,
      });
      setLastOrder({ ...result.order, items, total: cartTotal });
      setCart({});
      setShowCart(false);
    } catch (e) {
      setError(e.response?.data?.message || "Erreur lors de l'envoi");
    }
    setSubmitting(false);
  };

  const activeCatItems = categories.find(c => c.id === activeCat)?.items?.filter(i => i.is_active !== false) || [];
  const activeCatIndex = categories.findIndex(c => c.id === activeCat);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: "60vh", fontFamily: FONT, color: MUTED, fontSize: 14 }}>
      Chargement du menu…
    </div>
  );

  if (!restoSlug) return (
    <div style={{ padding: 24, fontFamily: FONT, color: MUTED, textAlign: "center", fontSize: 14 }}>
      Aucun restaurant associé à votre compte.
    </div>
  );

  /* ── Vue confirmation commande ── */
  if (lastOrder) return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      style={{ fontFamily: FONT, maxWidth: 480, margin: "60px auto", padding: 24, textAlign: "center" }}>
      <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#E8F5EE",
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <CheckCircle size={36} color={S} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: DARK, marginBottom: 8 }}>Commande envoyée !</h2>
      {lastOrder.table_label && (
        <div style={{ fontSize: 13, color: P, fontWeight: 600, marginBottom: 4 }}>Table {lastOrder.table_label}</div>
      )}
      {lastOrder.client_name && (
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>{lastOrder.client_name}</div>
      )}
      <div style={{ background: BG, borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left" }}>
        {lastOrder.items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: DARK, marginBottom: 6 }}>
            <span>{it.qty}× {it.name}</span>
            <span style={{ color: MUTED }}>{fmt(it.price * it.qty)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, color: DARK,
          marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${BORDER}` }}>
          <span>Total</span>
          <span style={{ color: P }}>{fmt(lastOrder.total)}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={clearCart}
          style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: P,
            color: "#1a1000", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
          Nouvelle commande
        </button>
      </div>
    </motion.div>
  );

  /* ── Interface principale POS ── */
  return (
    <div style={{ fontFamily: FONT, height: "calc(100vh - 50px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header avec sélecteur table + panier ── */}
      <div style={{ background: DARK, padding: "10px 16px", display: "flex", alignItems: "center",
        gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={18} color={P} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Service rapide</span>
        </div>

        {/* Sélecteur table */}
        <div style={{ position: "relative", flex: 1, maxWidth: 200 }}>
          <select value={tableLabel} onChange={e => setTableLabel(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,.1)", border: "0.5px solid rgba(255,255,255,.2)",
              borderRadius: 8, padding: "7px 28px 7px 10px", fontSize: 13, color: "white",
              cursor: "pointer", appearance: "none", fontFamily: FONT }}>
            <option value="">Table —</option>
            {tables.map(t => <option key={t.id} value={t.label}>{t.label} ({t.capacity}p)</option>)}
          </select>
          <ChevronDown size={12} color="rgba(255,255,255,.5)"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        </div>

        {/* Nom client */}
        <input value={clientName} onChange={e => setClientName(e.target.value)}
          placeholder="Nom client (optionnel)"
          style={{ background: "rgba(255,255,255,.1)", border: "0.5px solid rgba(255,255,255,.2)",
            borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "white",
            outline: "none", fontFamily: FONT, maxWidth: 180 }} />

        {/* Bouton panier (mobile) */}
        <motion.button whileTap={{ scale: 0.96 }}
          onClick={() => setShowCart(true)}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
            background: cartCount > 0 ? P : "rgba(255,255,255,.1)", border: "none",
            borderRadius: 9, padding: "8px 14px", cursor: "pointer", color: cartCount > 0 ? "#1a1000" : "rgba(255,255,255,.7)",
            fontWeight: 700, fontSize: 13, fontFamily: FONT, transition: "background .2s" }}>
          {cartCount > 0 ? `Panier · ${cartCount} article${cartCount > 1 ? "s" : ""} · ${fmt(cartTotal)}` : "Panier vide"}
        </motion.button>
      </div>

      {/* ── Tabs catégories ── */}
      <div style={{ background: "white", borderBottom: `0.5px solid ${BORDER}`,
        display: "flex", gap: 0, overflowX: "auto", flexShrink: 0 }}>
        {categories.map((cat, i) => {
          const active = cat.id === activeCat;
          const color  = catColor(i);
          return (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              style={{ padding: "11px 18px", border: "none", borderBottom: active ? `3px solid ${color}` : "3px solid transparent",
                background: "white", color: active ? color : MUTED, fontWeight: active ? 700 : 400,
                fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", fontFamily: FONT,
                transition: "all .15s" }}>
              {cat.name}
              <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>
                {(cat.items || []).filter(i => i.is_active !== false).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Corps : grille produits + panier sidebar ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Grille produits */}
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeCat}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}
              style={{ display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 10 }}>
              {activeCatItems.map(item => (
                <ProductCard key={item.id} item={item}
                  qty={cart[item.id]?.qty || 0}
                  onAdd={() => addItem(item)}
                  onRemove={() => removeItem(item.id)}
                  color={catColor(activeCatIndex)} />
              ))}
              {activeCatItems.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 0",
                  color: MUTED, fontSize: 14 }}>
                  Aucun plat disponible dans cette catégorie
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Panier sidebar — desktop uniquement */}
        {!isMobile && (
          <div style={{ width: 300, borderLeft: `0.5px solid ${BORDER}`, background: "white",
            display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <CartPanel
              cartItems={cartItems} cartTotal={cartTotal} cartCount={cartCount}
              tableLabel={tableLabel} clientName={clientName} orderNote={orderNote}
              setOrderNote={setOrderNote} error={error} submitting={submitting}
              onSend={sendOrder} onClear={clearCart} onRemove={removeItem}
              showNote={showNote} setShowNote={setShowNote} P={P} PL={PL}
              DARK={DARK} BG={BG} BORDER={BORDER} MUTED={MUTED} FONT={FONT} S={S} fmt={fmt}
            />
          </div>
        )}
      </div>

      {/* Panier drawer — mobile */}
      <AnimatePresence>
        {isMobile && showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50 }} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(320px, 90vw)",
                background: "white", zIndex: 51, display: "flex", flexDirection: "column",
                boxShadow: "-4px 0 20px rgba(0,0,0,.15)" }}>
              <div style={{ padding: "14px 16px", borderBottom: `0.5px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: DARK }}>Panier</span>
                <button onClick={() => setShowCart(false)}
                  style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <X size={18} color={MUTED} />
                </button>
              </div>
              <CartPanel
                cartItems={cartItems} cartTotal={cartTotal} cartCount={cartCount}
                tableLabel={tableLabel} clientName={clientName} orderNote={orderNote}
                setOrderNote={setOrderNote} error={error} submitting={submitting}
                onSend={() => { sendOrder(); setShowCart(false); }} onClear={clearCart}
                onRemove={removeItem} showNote={showNote} setShowNote={setShowNote}
                P={P} PL={PL} DARK={DARK} BG={BG} BORDER={BORDER} MUTED={MUTED} FONT={FONT} S={S} fmt={fmt}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Panneau panier (réutilisé mobile + desktop) ──────────────────────────── */
function CartPanel({ cartItems, cartTotal, cartCount, tableLabel, clientName, orderNote, setOrderNote,
  error, submitting, onSend, onClear, onRemove, showNote, setShowNote,
  P, PL, DARK, BG, BORDER, MUTED, FONT, S, fmt }) {
  return (
    <>
      {/* Résumé commande en cours */}
      <div style={{ padding: "12px 14px", borderBottom: `0.5px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase",
          letterSpacing: "0.8px", marginBottom: 8 }}>Commande en cours</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tableLabel && (
            <span style={{ fontSize: 11, background: "#1e2e28", color: "white",
              borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
              Table {tableLabel}
            </span>
          )}
          {clientName && (
            <span style={{ fontSize: 11, background: BG, color: MUTED, borderRadius: 6, padding: "2px 8px" }}>
              {clientName}
            </span>
          )}
          {!tableLabel && !clientName && (
            <span style={{ fontSize: 11, color: MUTED }}>Aucune table sélectionnée</span>
          )}
        </div>
      </div>

      {/* Liste articles */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
        {cartItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 13 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🛒</div>
            Aucun article sélectionné
          </div>
        ) : cartItems.map(({ item, qty }) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 0", borderBottom: `0.5px solid ${BG}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{item.name}</div>
              <div style={{ fontSize: 12, color: P, fontWeight: 600 }}>{fmt(item.price)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => onRemove(item.id)}
                style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${BORDER}`,
                  background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={10} color={MUTED} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: DARK, minWidth: 16, textAlign: "center" }}>{qty}</span>
              <button onClick={() => {}}
                style={{ width: 26, height: 26, borderRadius: "50%", border: "none",
                  background: P, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={10} color="white" />
              </button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: DARK, minWidth: 60, textAlign: "right" }}>
              {fmt(item.price * qty)}
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div style={{ padding: "0 14px 8px" }}>
        <button onClick={() => setShowNote(p => !p)}
          style={{ fontSize: 11, color: MUTED, background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, padding: "4px 0" }}>
          + {showNote ? "Masquer" : "Ajouter une note"}
        </button>
        {showNote && (
          <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)}
            placeholder="Instructions spéciales…" rows={2}
            style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 8,
              padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: FONT,
              resize: "none", boxSizing: "border-box", marginTop: 4, background: BG }} />
        )}
      </div>

      {/* Total + envoi */}
      <div style={{ padding: "12px 14px", borderTop: `0.5px solid ${BORDER}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: MUTED }}>{cartCount} article{cartCount > 1 ? "s" : ""}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: DARK }}>{fmt(cartTotal)}</span>
        </div>

        {error && <div style={{ padding: "7px 10px", background: "#FAECE7", borderRadius: 8,
          fontSize: 11, color: "#993C1D", marginBottom: 10 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          {cartItems.length > 0 && (
            <button onClick={onClear}
              style={{ padding: "10px 14px", borderRadius: 9, border: `0.5px solid ${BORDER}`,
                background: "white", cursor: "pointer", fontSize: 12, color: MUTED, fontFamily: FONT }}>
              <Trash2 size={14} />
            </button>
          )}
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={onSend} disabled={submitting || cartItems.length === 0}
            style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
              background: cartItems.length === 0 ? MUTED : "#1e2e28",
              color: cartItems.length === 0 ? "white" : P,
              fontSize: 14, fontWeight: 700, cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
              fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Send size={15} />
            {submitting ? "Envoi…" : "Envoyer en cuisine"}
          </motion.button>
        </div>
      </div>
    </>
  );
}
