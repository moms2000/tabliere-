/**
 * ClientMenu — Interface QR style BBR (Boulay Beach Resort)
 * Design premium : fond crème, chocolat foncé, typographie serif
 * Identique à https://bbr-boulay-beach-resort.vercel.app/order
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, X, Check, AlertTriangle, History, ArrowLeft, ShoppingBag } from "lucide-react";
import { menuService }        from "../../services/menu.service.js";
import { ordersService }      from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";

/* ── Design tokens BBR ────────────────────────────────────────────────────── */
const CREAM   = "#FAF6EF";   // fond principal
const SAND    = "#F2ECE3";   // fond secondaire / cards hover
const DARK    = "#1C1209";   // texte principal
const BROWN   = "#3B2010";   // bouton principal (chocolat)
const TEAL    = "#5B8989";   // accent (tagline "LIFE IS HERE")
const MUTED   = "#9B8E7E";   // texte secondaire
const BORDER  = "#E5DDD0";   // séparateurs
const WHITE   = "#FFFFFF";
const FONT_S  = "Georgia, 'Times New Roman', serif";
const FONT    = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

const fmt = (n) => n ? Number(n).toLocaleString("fr-CI") + " F" : "—";

/* ── Storage commandes ─────────────────────────────────────────────────────── */
const KEY = "tci_qr_orders";
const saveOrder = (o) => {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    arr.unshift(o);
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 20)));
  } catch (_) {}
};
const loadOrders = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };

const STATUS = {
  en_attente: { label: "En attente",     color: "#8B6914" },
  en_cours:   { label: "En préparation", color: "#185FA5" },
  servi:      { label: "Servi",          color: "#1D6B45" },
  annule:     { label: "Annulé",         color: "#8B1414" },
};

/* ── Composants ────────────────────────────────────────────────────────────── */

function BtnBrown({ children, onClick, disabled, style = {} }) {
  return (
    <motion.button whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={disabled ? undefined : onClick}
      style={{ background: disabled ? "#C4B8A8" : BROWN, color: WHITE,
        border: "none", borderRadius: 40, padding: "15px 0",
        fontSize: 13, fontWeight: 700, letterSpacing: "1.5px",
        textTransform: "uppercase", cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: FONT, width: "100%", ...style }}>
      {children}
    </motion.button>
  );
}

function HeaderNav({ title, onBack, table }) {
  return (
    <div style={{ background: WHITE, borderBottom: `0.5px solid ${BORDER}`,
      padding: "14px 20px", position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && (
          <button onClick={onBack}
            style={{ background: "none", border: "none", cursor: "pointer",
              color: MUTED, display: "flex", alignItems: "center", padding: 0 }}>
            <ArrowLeft size={18} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK, fontFamily: FONT_S }}>{title}</div>
          {table && <div style={{ fontSize: 11, color: MUTED }}>Table {table}</div>}
        </div>
        {/* Petit logo TablièreCI */}
        <div style={{ fontSize: 10, fontWeight: 800, color: BROWN,
          letterSpacing: "1.5px", textTransform: "uppercase" }}>
          TablièreCI
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function ClientMenu() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const table = searchParams.get("table") || "";

  const [resto,       setResto]       = useState(null);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [cart,        setCart]        = useState({});
  const [step,        setStep]        = useState("splash");
  const [submitting,  setSubmitting]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [lastOrder,   setLastOrder]   = useState(null);
  const [localOrders, setLocalOrders] = useState([]);
  const [activeCat,   setActiveCat]   = useState(null);
  const catRefs = useRef({});

  const [clientName,  setClientName]  = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [orderNote,   setOrderNote]   = useState("");
  const [agreed,      setAgreed]      = useState(false);

  const G = resto?.theme_color || BROWN;

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      restaurantsService.getBySlug(slug),
      menuService.getPublicMenu(slug),
    ]).then(([restoData, menuData]) => {
      const r = restoData.restaurant || restoData;
      setResto(r);
      const cats = (menuData.categories || []).filter(c => (c.items||[]).some(i => i.is_active !== false));
      setCategories(cats);
      if (cats.length > 0) setActiveCat(cats[0].id);
    }).catch(console.error).finally(() => setLoading(false));
    setLocalOrders(loadOrders());
  }, [slug]);

  /* ── Cart helpers ── */
  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((a, c) => a + c.qty, 0);
  const cartTotal = cartItems.reduce((a, c) => a + c.item.price * c.qty, 0);

  const addItem = (item) =>
    setCart(p => ({ ...p, [item.id]: { item, qty: (p[item.id]?.qty || 0) + 1, note: p[item.id]?.note || "", options: p[item.id]?.options || {} } }));
  const remItem = (id) =>
    setCart(p => { const qty = (p[id]?.qty || 0) - 1; if (qty <= 0) { const n = {...p}; delete n[id]; return n; } return { ...p, [id]: {...p[id], qty} }; });
  const setItemOpt = (id, key, val) =>
    setCart(p => ({ ...p, [id]: { ...p[id], options: { ...(p[id]?.options || {}), [key]: val } } }));

  const scrollToCat = (catId) => {
    setActiveCat(catId);
    catRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ── Place order ── */
  const placeOrder = async () => {
    setSubmitting(true); setErrorMsg("");
    try {
      const items = cartItems.map(({ item, qty, note, options }) => ({
        id: item.id, name: item.name, price: item.price, qty,
        note: note || undefined,
        options: options && Object.keys(options).length ? options : undefined,
      }));
      const result = await ordersService.create({
        restaurant_id: resto.id, table_label: table || undefined,
        client_name: clientName || undefined, client_phone: clientPhone || undefined,
        note: orderNote || undefined, items, total: cartTotal,
      });
      const newOrder = { id: result?.order?.id || String(Date.now()), status: "en_attente",
        total: cartTotal, items, created_at: new Date().toISOString(), table_label: table, client_name: clientName };
      setLastOrder(newOrder); saveOrder(newOrder); setLocalOrders(loadOrders()); setStep("confirm");
    } catch (e) {
      setErrorMsg(e.response?.data?.message || "Impossible d'envoyer la commande. Réessayez.");
    }
    setSubmitting(false);
  };

  const reset = () => { setCart({}); setClientName(""); setClientPhone(""); setOrderNote(""); setAgreed(false); setLastOrder(null); setErrorMsg(""); setStep("menu"); };

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: FONT }}>
      <div style={{ textAlign: "center" }}>
        <motion.div animate={{ opacity: [0.3,1,0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ fontSize: 22, fontFamily: FONT_S, color: BROWN, fontStyle: "italic" }}>
          Chargement…
        </motion.div>
      </div>
    </div>
  );

  if (!resto) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: FONT, color: MUTED, fontSize: 14 }}>
      Menu introuvable
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     SPLASH — BBR Style
  ══════════════════════════════════════════════════════════════════════════ */
  if (step === "splash") return (
    <div style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto",
      background: CREAM, fontFamily: FONT, overflowX: "hidden" }}>

      {/* Zone photo — 58vh */}
      <div style={{ position: "relative", height: "58vh", overflow: "hidden" }}>
        {resto.logo_url ? (
          <img src={resto.logo_url} alt={resto.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { e.target.style.display = "none"; }} />
        ) : (
          <div style={{ width: "100%", height: "100%",
            background: `linear-gradient(150deg, ${G}99 0%, ${DARK} 100%)` }} />
        )}

        {/* Overlay dégradé photo → crème */}
        <div style={{ position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.18) 50%, " + CREAM + " 100%)" }} />

        {/* Badge TABLE — haut droite */}
        {table && (
          <div style={{ position: "absolute", top: 20, right: 20,
            background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
            borderRadius: 20, padding: "4px 14px",
            fontSize: 10, fontWeight: 800, color: DARK,
            letterSpacing: "2.5px", textTransform: "uppercase" }}>
            TABLE {table}
          </div>
        )}

        {/* Logo TablièreCI — haut gauche */}
        <div style={{ position: "absolute", top: 20, left: 20,
          display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="rgba(255,255,255,0.18)" />
            <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
            <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
            <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
              stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" fill="none" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.75)",
            letterSpacing: "2px", textTransform: "uppercase" }}>TablièreCI</span>
        </div>

        {/* Nom restaurant — énorme, blanc, sur la photo (comme BBr) */}
        <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center",
          padding: "0 20px" }}>
          <div style={{ fontSize: "clamp(46px, 13vw, 72px)", fontWeight: 900, color: "rgba(255,255,255,0.92)",
            letterSpacing: "-1px", lineHeight: 1, fontFamily: FONT_S, textShadow: "0 2px 20px rgba(0,0,0,0.25)" }}>
            {resto.name?.toUpperCase()}
          </div>
          {resto.cuisine_type && (
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)",
              letterSpacing: "4px", textTransform: "uppercase", marginTop: 6 }}>
              {resto.cuisine_type?.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Zone crème — contenu */}
      <div style={{ background: CREAM, padding: "32px 28px 40px", textAlign: "center" }}>

        {/* Tagline style "LIFE IS HERE" */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: TEAL, letterSpacing: "3px",
            textTransform: "uppercase", fontStyle: "italic", marginBottom: 16 }}>
            {resto.quartier ? `${resto.quartier}${resto.ville ? ", " + resto.ville : ""}` : "La table est prête"}
          </div>
        </motion.div>

        {/* Titre "Bienvenue — Table X" */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: DARK, margin: "0 0 14px",
            fontFamily: FONT_S, lineHeight: 1.25 }}>
            {table ? `Bienvenue — Table ${table}` : `Bienvenue`}
          </h1>
        </motion.div>

        {/* Description */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.75, margin: "0 0 36px",
            fontFamily: FONT }}>
            {resto.description ||
              "Découvrez notre carte et commandez directement depuis votre table."}
          </p>
        </motion.div>

        {/* CTA "DÉCOUVRIR LA CARTE" */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <BtnBrown onClick={() => setStep("menu")}>
            Découvrir la carte
          </BtnBrown>
        </motion.div>

        {/* Lien historique si déjà commandé */}
        {localOrders.length > 0 && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
            onClick={() => setStep("history")}
            style={{ marginTop: 16, background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: MUTED, fontFamily: FONT,
              display: "flex", alignItems: "center", gap: 6, margin: "16px auto 0" }}>
            <History size={14} /> Voir mes commandes ({localOrders.length})
          </motion.button>
        )}

        {/* Footer discret */}
        <div style={{ marginTop: 40, fontSize: 9, color: "#C4B8A8",
          letterSpacing: "2px", textTransform: "uppercase" }}>
          Tablière CI
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     MENU PRINCIPAL — Catégories + Plats
  ══════════════════════════════════════════════════════════════════════════ */
  if (step === "menu") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
      margin: "0 auto", fontFamily: FONT, paddingBottom: cartCount > 0 ? 96 : 24 }}>

      {/* Header */}
      <div style={{ background: WHITE, borderBottom: `0.5px solid ${BORDER}`,
        position: "sticky", top: 0, zIndex: 20 }}>
        {/* Infos resto */}
        <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: DARK, fontFamily: FONT_S }}>{resto.name}</div>
            {table && <div style={{ fontSize: 11, color: MUTED }}>Table {table}</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {localOrders.length > 0 && (
              <button onClick={() => setStep("history")}
                style={{ background: SAND, border: "none", borderRadius: 20, padding: "5px 12px",
                  fontSize: 11, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <History size={12} /> Historique
              </button>
            )}
          </div>
        </div>

        {/* Tabs catégories — scrollable */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto", padding: "10px 16px 0",
          scrollbarWidth: "none" }}>
          {categories.map(cat => {
            const items = (cat.items || []).filter(i => i.is_active !== false);
            if (!items.length) return null;
            const active = activeCat === cat.id;
            return (
              <button key={cat.id} onClick={() => scrollToCat(cat.id)}
                style={{ padding: "8px 14px", border: "none", cursor: "pointer",
                  background: "transparent", whiteSpace: "nowrap", fontFamily: FONT,
                  fontSize: 13, fontWeight: active ? 700 : 400,
                  color: active ? BROWN : MUTED,
                  borderBottom: `2px solid ${active ? BROWN : "transparent"}`,
                  transition: "all .15s" }}>
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste produits par catégorie */}
      <div>
        {categories.map(cat => {
          const items = (cat.items || []).filter(i => i.is_active !== false && i.is_available !== false);
          if (!items.length) return null;
          return (
            <div key={cat.id} ref={el => { catRefs.current[cat.id] = el; }}>
              {/* Titre catégorie */}
              <div style={{ padding: "20px 20px 8px",
                fontSize: 11, fontWeight: 700, color: MUTED,
                letterSpacing: "2px", textTransform: "uppercase" }}>
                {cat.name}
              </div>

              {/* Items */}
              {items.map(item => {
                const inCart = cart[item.id]?.qty || 0;
                const opts = (() => { try { return typeof item.options === "string" ? JSON.parse(item.options) : item.options; } catch { return null; } })();
                return (
                  <div key={item.id}
                    style={{ display: "flex", gap: 14, padding: "14px 20px",
                      borderBottom: `0.5px solid ${BORDER}`, background: WHITE,
                      transition: "background .15s" }}>

                    {/* Photo ou placeholder */}
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name}
                        style={{ width: 84, height: 84, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: `0.5px solid ${BORDER}` }}
                        onError={e => { e.target.style.display = "none"; }} />
                    ) : (
                      <div style={{ width: 84, height: 84, borderRadius: 12, flexShrink: 0,
                        background: SAND, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 26 }}>🍽️</div>
                    )}

                    {/* Infos */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: DARK,
                        fontFamily: FONT_S, marginBottom: 4, lineHeight: 1.3 }}>
                        {item.name}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 6,
                          overflow: "hidden", display: "-webkit-box",
                          WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {item.description}
                        </div>
                      )}

                      {/* Options tags */}
                      {opts && (opts.cuissons?.length || opts.accompagnements?.length) ? (
                        <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
                          {opts.cuissons?.length > 0 && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10,
                              background: "#F0EBE3", color: BROWN, fontWeight: 700, letterSpacing: "0.5px" }}>
                              Cuisson
                            </span>
                          )}
                          {opts.accompagnements?.length > 0 && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10,
                              background: "#F0EBE3", color: BROWN, fontWeight: 700, letterSpacing: "0.5px" }}>
                              Accompagnement
                            </span>
                          )}
                        </div>
                      ) : null}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: BROWN }}>
                          {fmt(item.price)}
                        </div>

                        {/* Contrôle quantité */}
                        {inCart > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button onClick={() => remItem(item.id)}
                              style={{ width: 30, height: 30, borderRadius: "50%",
                                border: `1.5px solid ${BORDER}`, background: WHITE,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Minus size={12} color={MUTED} />
                            </button>
                            <motion.span key={inCart} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                              style={{ fontSize: 15, fontWeight: 800, color: BROWN, minWidth: 16, textAlign: "center" }}>
                              {inCart}
                            </motion.span>
                            <button onClick={() => addItem(item)}
                              style={{ width: 30, height: 30, borderRadius: "50%",
                                border: "none", background: BROWN,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Plus size={12} color={WHITE} />
                            </button>
                          </div>
                        ) : (
                          <motion.button whileTap={{ scale: 0.92 }} onClick={() => addItem(item)}
                            style={{ width: 34, height: 34, borderRadius: "50%",
                              border: "none", background: BROWN,
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: `0 3px 12px ${BROWN}40` }}>
                            <Plus size={15} color={WHITE} />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {categories.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: MUTED }}>
            Menu non disponible
          </div>
        )}
      </div>

      {/* Bouton panier flottant */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
              width: "calc(100% - 40px)", maxWidth: 440, zIndex: 30 }}>
            <button onClick={() => setStep("cart")}
              style={{ width: "100%", padding: "16px 20px", borderRadius: 40, border: "none",
                background: BROWN, color: WHITE, fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: FONT, display: "flex",
                alignItems: "center", justifyContent: "space-between",
                letterSpacing: "0.5px",
                boxShadow: `0 6px 24px ${BROWN}55` }}>
              <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: "50%",
                width: 26, height: 26, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 12, fontWeight: 900 }}>
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

  /* ══════════════════════════════════════════════════════════════════════════
     PANIER
  ══════════════════════════════════════════════════════════════════════════ */
  if (step === "cart") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
      margin: "0 auto", fontFamily: FONT, paddingBottom: 100 }}>
      <HeaderNav title="Mon panier" table={table} onBack={() => setStep("menu")} />

      <div style={{ padding: "16px 20px" }}>
        {cartItems.map(({ item, qty, note, options }) => {
          const opts = (() => { try { return typeof item.options === "string" ? JSON.parse(item.options) : item.options; } catch { return null; } })();
          return (
            <div key={item.id} style={{ background: WHITE, borderRadius: 14, padding: "14px 16px",
              marginBottom: 10, border: `0.5px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {item.image_url && (
                  <img src={item.image_url} alt={item.name}
                    style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                    onError={e => { e.target.style.display = "none"; }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: DARK, fontFamily: FONT_S }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: BROWN, fontWeight: 700, marginTop: 2 }}>{fmt(item.price)}</div>
                  {options?.cuisson && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>Cuisson : {options.cuisson}</div>}
                  {options?.accompagnement && <div style={{ fontSize: 11, color: MUTED }}>Avec : {options.accompagnement}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <button onClick={() => remItem(item.id)}
                    style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${BORDER}`,
                      background: WHITE, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Minus size={11} color={MUTED} />
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 800, color: DARK, minWidth: 16, textAlign: "center" }}>{qty}</span>
                  <button onClick={() => addItem(item)}
                    style={{ width: 28, height: 28, borderRadius: "50%", border: "none",
                      background: BROWN, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={11} color={WHITE} />
                  </button>
                </div>
              </div>

              {/* Options cuisson/accompagnement */}
              {opts && (opts.cuissons?.length || opts.accompagnements?.length) && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {opts.cuissons?.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: "1px" }}>Cuisson</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {opts.cuissons.map(c => (
                          <button key={c} onClick={() => setItemOpt(item.id, "cuisson", c)}
                            style={{ padding: "4px 11px", borderRadius: 20, border: "none", fontSize: 11, cursor: "pointer",
                              background: options?.cuisson === c ? BROWN : SAND,
                              color: options?.cuisson === c ? WHITE : MUTED,
                              fontWeight: options?.cuisson === c ? 600 : 400 }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {opts.accompagnements?.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: "1px" }}>Accompagnement</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {opts.accompagnements.map(a => (
                          <button key={a} onClick={() => setItemOpt(item.id, "accompagnement", a)}
                            style={{ padding: "4px 11px", borderRadius: 20, border: "none", fontSize: 11, cursor: "pointer",
                              background: options?.accompagnement === a ? BROWN : SAND,
                              color: options?.accompagnement === a ? WHITE : MUTED,
                              fontWeight: options?.accompagnement === a ? 600 : 400 }}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Total */}
        <div style={{ background: WHITE, borderRadius: 14, padding: "16px 18px",
          border: `0.5px solid ${BORDER}`, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            fontWeight: 800, fontSize: 17, color: DARK }}>
            <span>Total</span>
            <span style={{ color: BROWN }}>{fmt(cartTotal)}</span>
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
            {cartCount} article{cartCount > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Footer fixe */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, padding: "12px 20px 28px",
        background: `linear-gradient(to top, ${CREAM} 70%, transparent)` }}>
        <BtnBrown onClick={() => setStep("info")}>
          Continuer →
        </BtnBrown>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     INFOS CLIENT
  ══════════════════════════════════════════════════════════════════════════ */
  if (step === "info") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
      margin: "0 auto", fontFamily: FONT, paddingBottom: 120 }}>
      <HeaderNav title="Vos informations" table={table} onBack={() => setStep("cart")} />

      <div style={{ padding: "24px 20px" }}>

        {/* Champs */}
        {[
          { label: "Nom complet *", value: clientName, set: setClientName, ph: "Jean Kouassi", required: true },
          { label: "Téléphone", value: clientPhone, set: setClientPhone, ph: "+225 07 00 00 00 00", type: "tel" },
        ].map(({ label, value, set, ph, required, type }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED,
              textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
              {label}
            </label>
            <input value={value} onChange={e => set(e.target.value)}
              placeholder={ph} type={type || "text"}
              style={{ width: "100%", background: WHITE, border: `0.5px solid ${value ? BROWN : BORDER}`,
                borderRadius: 10, padding: "13px 14px", fontSize: 15, color: DARK,
                outline: "none", fontFamily: FONT, boxSizing: "border-box",
                transition: "border-color .2s" }} />
          </div>
        ))}

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED,
            textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
            Notes / allergies (optionnel)
          </label>
          <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)}
            placeholder="Sans gluten, pas d'oignons, anniversaire…" rows={3}
            style={{ width: "100%", background: WHITE, border: `0.5px solid ${BORDER}`,
              borderRadius: 10, padding: "13px 14px", fontSize: 14, color: DARK,
              outline: "none", fontFamily: FONT, resize: "none", boxSizing: "border-box" }} />
        </div>

        {/* Récapitulatif compact */}
        <div style={{ background: WHITE, borderRadius: 12, padding: "14px 16px",
          border: `0.5px solid ${BORDER}`, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
            letterSpacing: "1.5px", marginBottom: 10 }}>Récapitulatif</div>
          {cartItems.map(({ item, qty, options }) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between",
              fontSize: 13, color: DARK, marginBottom: 5 }}>
              <span style={{ color: MUTED }}>{qty}× {item.name}
                {options?.cuisson ? ` — ${options.cuisson}` : ""}
              </span>
              <span style={{ fontWeight: 600, color: BROWN }}>{fmt(item.price * qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800,
            fontSize: 15, marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${BORDER}` }}>
            <span>Total</span>
            <span style={{ color: BROWN }}>{fmt(cartTotal)}</span>
          </div>
        </div>

        {/* ── Case à cocher OBLIGATOIRE ── */}
        <motion.div onClick={() => setAgreed(p => !p)}
          animate={{ borderColor: agreed ? BROWN : BORDER }}
          style={{ background: agreed ? BROWN + "0A" : WHITE,
            borderRadius: 12, padding: "14px 16px", marginBottom: 4,
            border: `1.5px solid ${agreed ? BROWN : BORDER}`,
            cursor: "pointer", transition: "all .2s" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <motion.div animate={{ background: agreed ? BROWN : WHITE, scale: agreed ? [1.1, 1] : 1 }}
              style={{ width: 22, height: 22, borderRadius: 6,
                border: `2px solid ${agreed ? BROWN : BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginTop: 1, transition: "all .2s" }}>
              {agreed && <Check size={13} color={WHITE} strokeWidth={3} />}
            </motion.div>
            <div style={{ fontSize: 12, color: agreed ? DARK : MUTED, lineHeight: 1.65,
              transition: "color .2s" }}>
              <strong style={{ color: agreed ? BROWN : MUTED }}>
                J'ai vérifié ma commande et je m'engage à la régler en totalité.
              </strong>
              {" "}En cas d'erreur de ma part sur les articles commandés, je suis entièrement responsable.
            </div>
          </div>
          {!agreed && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8,
              fontSize: 10, color: "#B8860B", paddingLeft: 34 }}>
              <AlertTriangle size={10} /> Obligatoire pour valider
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, padding: "12px 20px 28px",
        background: `linear-gradient(to top, ${CREAM} 70%, transparent)` }}>
        <BtnBrown onClick={placeOrder} disabled={submitting || !clientName.trim() || !agreed}>
          {submitting ? "Envoi en cours…" : `Confirmer · ${fmt(cartTotal)}`}
        </BtnBrown>
        {!clientName.trim() && (
          <div style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 6 }}>
            Votre nom est requis
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
          background: "#8B1414", color: WHITE, borderRadius: 10, padding: "10px 20px",
          fontSize: 13, maxWidth: 440, textAlign: "center" }}>
          {errorMsg}
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     CONFIRMATION
  ══════════════════════════════════════════════════════════════════════════ */
  if (step === "confirm") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
      margin: "0 auto", fontFamily: FONT, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>

      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{ textAlign: "center", width: "100%", maxWidth: 360 }}>

        {/* Icône succès */}
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ delay: 0.2, duration: 0.4 }}
          style={{ width: 72, height: 72, borderRadius: "50%", background: BROWN,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <Check size={36} color={WHITE} strokeWidth={2.5} />
        </motion.div>

        <h2 style={{ fontSize: 26, fontWeight: 400, color: DARK, fontFamily: FONT_S,
          margin: "0 0 8px" }}>Commande envoyée !</h2>
        {clientName && <div style={{ fontSize: 14, color: MUTED, marginBottom: 4 }}>Merci, {clientName}</div>}
        {table && <div style={{ fontSize: 12, color: BROWN, fontWeight: 700, marginBottom: 16 }}>Table {table}</div>}

        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 28 }}>
          Votre commande a été transmise à la cuisine.<br />
          Nous vous apportons cela dans les plus brefs délais.
        </p>

        {/* Résumé */}
        <div style={{ background: WHITE, borderRadius: 14, padding: "16px 18px",
          border: `0.5px solid ${BORDER}`, marginBottom: 28, textAlign: "left" }}>
          {(lastOrder?.items || []).map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between",
              fontSize: 13, color: DARK, marginBottom: 5 }}>
              <span style={{ color: MUTED }}>{it.qty}× {it.name}</span>
              <span style={{ color: BROWN, fontWeight: 600 }}>{fmt(it.price * it.qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800,
            fontSize: 16, marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${BORDER}` }}>
            <span>Total</span>
            <span style={{ color: BROWN }}>{fmt(lastOrder?.total)}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <BtnBrown onClick={reset}>Nouvelle commande</BtnBrown>
          <button onClick={() => setStep("history")}
            style={{ padding: "14px 0", borderRadius: 40, border: `1.5px solid ${BORDER}`,
              background: "transparent", color: MUTED, fontSize: 13, cursor: "pointer",
              fontFamily: FONT }}>
            Voir mes commandes
          </button>
        </div>
      </motion.div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     HISTORIQUE
  ══════════════════════════════════════════════════════════════════════════ */
  if (step === "history") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
      margin: "0 auto", fontFamily: FONT }}>
      <HeaderNav title="Mes commandes" table={table} onBack={() => setStep("menu")} />

      <div style={{ padding: "16px 20px" }}>
        {localOrders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
            <ShoppingBag size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Aucune commande dans cette session</div>
          </div>
        ) : localOrders.map((o, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{ background: WHITE, borderRadius: 14, padding: 16,
              marginBottom: 12, border: `0.5px solid ${BORDER}` }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: MUTED }}>
                  {new Date(o.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                </div>
                {o.table_label && <div style={{ fontSize: 11, color: MUTED }}>Table {o.table_label}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                background: (STATUS[o.status]?.color || "#888") + "18",
                color: STATUS[o.status]?.color || "#888",
                border: `0.5px solid ${(STATUS[o.status]?.color || "#888")}44` }}>
                {STATUS[o.status]?.label || o.status}
              </span>
            </div>
            <div style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 10 }}>
              {(o.items || []).map((it, j) => (
                <div key={j} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 13, color: DARK, marginBottom: 4 }}>
                  <span style={{ color: MUTED }}>{it.qty}× {it.name}</span>
                  <span style={{ color: BROWN, fontWeight: 600 }}>{fmt(it.price * it.qty)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between",
                fontWeight: 800, fontSize: 14, marginTop: 8, paddingTop: 8,
                borderTop: `0.5px solid ${BORDER}` }}>
                <span style={{ color: DARK }}>Total</span>
                <span style={{ color: BROWN }}>{fmt(o.total)}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  return null;
}
