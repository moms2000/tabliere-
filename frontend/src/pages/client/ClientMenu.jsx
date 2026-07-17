/**
 * ClientMenu — Interface QR identique BBR (Boulay Beach Resort)
 * Screens: splash → menu → item → cart → info → confirm
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ShoppingCart, Search, ArrowLeft, Check, AlertTriangle, History, RefreshCw, ChevronRight, Utensils } from "lucide-react";
import { menuService }        from "../../services/menu.service.js";
import { ordersService }      from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";

/* ── Tokens BBR + TablièreCI ──────────────────────────────────────────────── */
const CREAM  = "#FAF6EF";
const SAND   = "#F2ECE3";
const DARK   = "#1C1209";
const BROWN  = "#3B2010";
const MUTED  = "#9B8E7E";
const BORDER = "#E5DDD0";
const WHITE  = "#FFFFFF";
const FS     = "Georgia,'Times New Roman',serif";
const FN     = "'Avenir Next','Avenir','Century Gothic',sans-serif";

// Couleurs officielle TablièreCI (du logo)
const TCI_DARK  = "#1E2E28"; // vert forêt foncé
const TCI_AMBER = "#E8A045"; // orange amber
const TCI_GREEN = "#3D6B55"; // vert sauge

/* ── Écran intro animé (style Airbnb / OpenTable) ────────────────────────── */
function IntroScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
      style={{ position: "fixed", inset: 0, background: TCI_DARK, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 0, fontFamily: FN }}>

      {/* Logo animé */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.1 }}>

        {/* Icône SVG TablièreCI plein — plus grande */}
        <svg width="80" height="80" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="10" fill={TCI_AMBER} />
          <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
          <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
          <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
            stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" fill="none" />
        </svg>
      </motion.div>

      {/* Nom TablièreCI */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.45 }}
        style={{ marginTop: 20, textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: WHITE, letterSpacing: "-0.5px" }}>
          Tablière<span style={{ color: TCI_AMBER }}>CI</span>
        </div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 6,
            letterSpacing: "3px", textTransform: "uppercase" }}>
          Réserver · Commander
        </motion.div>
      </motion.div>

      {/* Point de chargement animé */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
        style={{ position: "absolute", bottom: 48, display: "flex", gap: 6 }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
            style={{ width: 6, height: 6, borderRadius: "50%", background: TCI_AMBER }} />
        ))}
      </motion.div>
    </motion.div>
  );
}

const fmt = (n) => n ? Number(n).toLocaleString("fr-CI") + " F" : "—";

/* ── Helpers localStorage ─────────────────────────────────────────────────── */
const KEY = "tci_qr_orders";
const saveOrder = (o) => {
  try { const a = JSON.parse(localStorage.getItem(KEY)||"[]"); a.unshift(o); localStorage.setItem(KEY,JSON.stringify(a.slice(0,20))); } catch(_){}
};
const loadOrders = () => { try { return JSON.parse(localStorage.getItem(KEY)||"[]"); } catch { return []; }};

/* ── Composants partagés ─────────────────────────────────────────────────── */

/* Logo TablièreCI SVG */
function TCILogo({ size = 24, color = BROWN }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill={color} fillOpacity="0.12" />
      <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill={color} />
      <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill={color} />
      <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5" stroke={color} strokeWidth="1.3" strokeOpacity=".5" fill="none" />
    </svg>
  );
}

/* Header BBR — présent sur toutes les pages après splash */
function BBRHeader({ restoName, table, cartCount, onCartClick, onBack }) {
  return (
    <div style={{ background: WHITE, borderBottom: `0.5px solid ${BORDER}`,
      padding: "10px 16px", display: "flex", alignItems: "center",
      justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
      {/* Gauche: retour ou logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 60 }}>
        {onBack ? (
          <button onClick={onBack} style={{ background: "none", border: "none",
            cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: DARK }}>
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TCILogo size={22} />
            <span style={{ fontSize: 11, fontWeight: 800, color: BROWN,
              letterSpacing: "0.5px", textTransform: "uppercase" }}>TablièreCI</span>
          </div>
        )}
      </div>

      {/* Centre: nom du restaurant */}
      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, fontFamily: FS, lineHeight: 1.2 }}>
          {restoName}
        </div>
        {table && (
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: "1px", textTransform: "uppercase" }}>
            Table {table}
          </div>
        )}
      </div>

      {/* Droite: panier */}
      <div style={{ minWidth: 60, display: "flex", justifyContent: "flex-end" }}>
        {onCartClick && (
          <button onClick={onCartClick}
            style={{ position: "relative", background: cartCount > 0 ? BROWN : SAND,
              border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background .2s" }}>
            <ShoppingCart size={16} color={cartCount > 0 ? WHITE : MUTED} />
            {cartCount > 0 && (
              <span style={{ position: "absolute", top: -3, right: -3, background: BROWN,
                color: WHITE, borderRadius: "50%", width: 16, height: 16, fontSize: 9,
                fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${WHITE}` }}>
                {cartCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* Petite bande photo héro (comme BBR sur la page menu) */
function HeroBand({ logoUrl, restoName, table, height = 160 }) {
  return (
    <div style={{ position: "relative", height, overflow: "hidden", background: SAND }}>
      {logoUrl ? (
        <img src={logoUrl} alt={restoName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { e.target.style.display = "none"; }} />
      ) : (
        <div style={{ width: "100%", height: "100%",
          background: `linear-gradient(135deg, ${BROWN}22 0%, ${SAND} 100%)` }} />
      )}
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,.06) 0%, rgba(250,246,239,.7) 100%)" }} />
      {table && (
        <div style={{ position: "absolute", bottom: 12, left: 16,
          fontSize: 15, fontWeight: 400, color: DARK, fontFamily: FS, fontStyle: "italic" }}>
          Table {table}
        </div>
      )}
    </div>
  );
}

/* Bouton brun full-width */
function BrownBtn({ children, onClick, disabled, style = {} }) {
  return (
    <motion.button whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={disabled ? undefined : onClick}
      style={{ background: disabled ? "#C4B8A8" : BROWN, color: WHITE,
        border: "none", borderRadius: 8, padding: "16px 0", width: "100%",
        fontSize: 13, fontWeight: 700, letterSpacing: "1.5px",
        textTransform: "uppercase", cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: FN, ...style }}>
      {children}
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════════ */
export default function ClientMenu() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const table = searchParams.get("table") || "";

  const [resto,       setResto]       = useState(null);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadErr,     setLoadErr]     = useState(false);
  const [step,        setStep]        = useState("intro"); // intro → splash → menu → ...
  const [activeItem,  setActiveItem]  = useState(null);   // item détail
  const [selectedCat, setSelectedCat] = useState("tous"); // "tous" ou cat.id
  const [search,      setSearch]      = useState("");
  const [cart,        setCart]        = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [lastOrder,   setLastOrder]   = useState(null);
  const [localOrders, setLocalOrders] = useState([]);

  // Infos client
  const [clientName,  setClientName]  = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [orderNote,   setOrderNote]   = useState("");
  const [agreed,      setAgreed]      = useState(false);

  // Item detail state
  const [itemQty,     setItemQty]     = useState(1);
  const [itemCuisson, setItemCuisson] = useState("");
  const [itemAccomp,  setItemAccomp]  = useState("");
  const [itemNote,    setItemNote]    = useState("");

  const loadMenu = useCallback(() => {
    if (!slug) { setLoading(false); setLoadErr(true); return; }
    setLoading(true); setLoadErr(false);
    Promise.all([
      restaurantsService.getBySlug(slug),
      menuService.getPublicMenu(slug),
    ]).then(([rd, md]) => {
      const r = rd.restaurant || rd;
      setResto(r);
      const cats = (md.categories || []).filter(c => (c.items||[]).some(i => i.is_active !== false));
      setCategories(cats);
    }).catch((e) => {
      // 404 = resto inexistant (reste "introuvable") ; sinon = panne réseau/cold-start (retry possible)
      if (e?.response?.status === 404) setResto(null);
      else setLoadErr(true);
    }).finally(() => setLoading(false));
    setLocalOrders(loadOrders());
  }, [slug]);
  useEffect(() => { loadMenu(); }, [loadMenu]);

  /* ── Panier (mémoïsé) ── */
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(() => cartItems.reduce((a, c) => a + c.qty, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((a, c) => a + c.item.price * c.qty, 0), [cartItems]);

  const openItem = (item) => {
    setActiveItem(item);
    setItemQty(cart[item.id]?.qty || 1);
    const opts = parseOpts(item);
    setItemCuisson(cart[item.id]?.options?.cuisson || (opts?.cuissons?.[0] || ""));
    setItemAccomp(cart[item.id]?.options?.accompagnement || "");
    setItemNote(cart[item.id]?.note || "");
    setStep("item");
  };

  const parseOpts = (item) => {
    if (!item?.options) return null;
    let opts;
    try { opts = typeof item.options === "string" ? JSON.parse(item.options) : item.options; } catch { return null; }
    if (!opts) return null;
    // Normaliser : accepter tableau OU chaîne legacy, et re-découper chaque
    // entrée sur , ; ! ou retour ligne (corrige les données "Saignant!Biencuit"
    // qui s'affichaient en une seule bulle)
    const splitAll = (val) => {
      const arr = Array.isArray(val) ? val : (val == null ? [] : [val]);
      return arr.flatMap(s => String(s).split(/[,;!\n]/))
        .map(s => s.trim()).filter(Boolean);
    };
    return {
      ...opts,
      cuissons:        splitAll(opts.cuissons),
      accompagnements: splitAll(opts.accompagnements),
    };
  };

  const addItemToCart = () => {
    const item = activeItem;
    setCart(p => ({
      ...p,
      [item.id]: {
        item,
        qty: itemQty,
        note: itemNote,
        options: {
          ...(itemCuisson ? { cuisson: itemCuisson } : {}),
          ...(itemAccomp  ? { accompagnement: itemAccomp } : {}),
        },
      },
    }));
    setStep("menu");
  };

  const remItem = (id) =>
    setCart(p => { const qty = (p[id]?.qty||0) - 1; if(qty<=0){const n={...p};delete n[id];return n;} return {...p,[id]:{...p[id],qty}}; });

  const addOne = (item) =>
    setCart(p => ({ ...p, [item.id]: { item, qty: (p[item.id]?.qty||0)+1, note: p[item.id]?.note||"", options: p[item.id]?.options||{} } }));

  /* ── Filtre (mémoïsé — évite de re-filtrer tout le catalogue à chaque frappe) ── */
  const allItems = useMemo(
    () => categories.flatMap(c => {
      const its = (c.items || []).filter(i => i.is_active !== false && i.is_available !== false);
      // Regrouper par sous-catégorie (sans sous-catégorie en premier), ordre préservé
      const order = [], groups = {};
      its.forEach(i => { const k = (i.subcategory || "").trim(); if (!(k in groups)) { groups[k] = []; order.push(k); } groups[k].push(i); });
      order.sort((a, b) => (a === "" ? -1 : b === "" ? 1 : 0));
      return order.flatMap(k => groups[k]).map(i => ({ ...i, catId: c.id, catName: c.name }));
    }),
    [categories]
  );
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return allItems.filter(i => {
      const matchCat = selectedCat === "tous" || i.catId === selectedCat;
      const matchSearch = !q || i.name.toLowerCase().includes(q) || (i.description||"").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allItems, selectedCat, search]);

  /* ── Commande ── */
  const placeOrder = async () => {
    setSubmitting(true); setErrorMsg("");
    try {
      const items = cartItems.map(({ item, qty, note, options }) => ({
        id: item.id, name: item.name, price: item.price, qty,
        note: note||undefined, options: options&&Object.keys(options).length?options:undefined,
      }));
      const result = await ordersService.create({
        restaurant_id: resto.id, table_label: table||undefined,
        client_name: clientName||undefined, client_phone: clientPhone||undefined,
        client_email: clientEmail||undefined,
        note: orderNote||undefined, items, total: cartTotal,
      });
      const newOrder = {
        id: result?.order?.id || String(Date.now()),
        ref: result?.order?.ref || "CMD-" + Math.random().toString(36).slice(2,7).toUpperCase(),
        status: "en_attente", total: cartTotal, items,
        created_at: new Date().toISOString(), table_label: table, client_name: clientName,
      };
      setLastOrder(newOrder); saveOrder(newOrder); setLocalOrders(loadOrders()); setStep("confirm");
    } catch (e) {
      setErrorMsg(e.response?.data?.message || "Impossible d'envoyer la commande.");
    }
    setSubmitting(false);
  };

  const reset = () => { setCart({}); setClientName(""); setClientPhone(""); setOrderNote(""); setAgreed(false); setLastOrder(null); setErrorMsg(""); setStep("menu"); };

  /* ── Intro animation ── */
  if (step === "intro") return (
    <AnimatePresence>
      <IntroScreen onDone={() => setStep("splash")} />
    </AnimatePresence>
  );

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: FN }}>
      <motion.div animate={{ opacity: [.4,1,.4] }} transition={{ repeat: Infinity, duration: 1.6 }}
        style={{ fontSize: 20, fontFamily: FS, color: BROWN, fontStyle: "italic" }}>
        Chargement…
      </motion.div>
    </div>
  );

  /* ── Erreur de chargement (réseau / cold-start) : proposer un retry ── */
  if (loadErr) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16, color: MUTED, fontFamily: FN, padding: 24, textAlign: "center" }}>
      <AlertTriangle size={34} color={BROWN} />
      <div style={{ fontSize: 15, color: BROWN }}>Impossible de charger le menu.<br/>Vérifiez votre connexion et réessayez.</div>
      <button onClick={loadMenu}
        style={{ display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: 10,
          padding: "11px 22px", background: BROWN, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FN }}>
        <RefreshCw size={15} /> Réessayer
      </button>
    </div>
  );

  if (!resto) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center",
      justifyContent: "center", color: MUTED, fontFamily: FN }}>Menu introuvable</div>
  );

  /* ── QR Menu désactivé par l'administrateur : commande via QR indisponible ── */
  if (resto.qr_active === false) return (
    <div style={{ minHeight: "100vh", background: CREAM, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14, color: MUTED, fontFamily: FN,
      padding: 24, textAlign: "center" }}>
      <AlertTriangle size={38} color={BROWN} />
      <div style={{ fontSize: 19, fontFamily: FS, color: BROWN, fontStyle: "italic" }}>{resto.name}</div>
      <div style={{ fontSize: 15, color: BROWN, maxWidth: 320, lineHeight: 1.5 }}>
        La commande via QR Code n'est pas activée pour ce restaurant.
      </div>
      <div style={{ fontSize: 13, color: MUTED, maxWidth: 320 }}>
        Adressez-vous au personnel pour passer commande.
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     SPLASH — Style BBR
  ══════════════════════════════════════════════════════════════════════ */
  if (step === "splash") return (
    <div style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", background: CREAM, fontFamily: FN }}>

      {/* Photo héro */}
      <div style={{ position: "relative", height: "58vh", overflow: "hidden", background: SAND }}>
        {resto.logo_url ? (
          <img src={resto.logo_url} alt={resto.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { e.target.style.display = "none"; }} />
        ) : (
          <div style={{ width: "100%", height: "100%",
            background: `linear-gradient(150deg, ${BROWN}33, ${SAND})` }} />
        )}
        <div style={{ position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,.08), rgba(0,0,0,.18) 50%, " + CREAM + " 100%)" }} />

        {/* Badge TABLE */}
        {table && (
          <div style={{ position: "absolute", top: 18, right: 18,
            background: "rgba(255,255,255,.94)", borderRadius: 20, padding: "4px 14px",
            fontSize: 10, fontWeight: 800, color: DARK, letterSpacing: "2.5px", textTransform: "uppercase" }}>
            TABLE {table}
          </div>
        )}

        {/* TablièreCI haut gauche */}
        <div style={{ position: "absolute", top: 18, left: 18, display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="rgba(255,255,255,.18)" />
            <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
            <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
            <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" fill="none" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,.8)",
            letterSpacing: "1.5px", textTransform: "uppercase" }}>TablièreCI</span>
        </div>

        {/* Nom restaurant ÉNORME */}
        <div style={{ position: "absolute", bottom: 48, left: 0, right: 0, textAlign: "center", padding: "0 20px" }}>
          <div style={{ fontSize: "clamp(44px, 12vw, 68px)", fontWeight: 900, color: "rgba(255,255,255,.93)",
            lineHeight: 1, fontFamily: FS, textShadow: "0 2px 20px rgba(0,0,0,.2)" }}>
            {resto.name?.toUpperCase()}
          </div>
          {resto.cuisine_type && (
            <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.6)",
              letterSpacing: "4px", textTransform: "uppercase", marginTop: 6 }}>
              {resto.cuisine_type}
            </div>
          )}
        </div>
      </div>

      {/* Contenu crème */}
      <div style={{ padding: "32px 28px 40px", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .2 }}>
          <div style={{ fontSize: 11, color: "#6B8989", letterSpacing: "3px",
            textTransform: "uppercase", fontStyle: "italic", marginBottom: 16 }}>
            {resto.quartier || "La table est prête"}
          </div>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 }}
          style={{ fontSize: 27, fontWeight: 400, color: DARK, fontFamily: FS,
            margin: "0 0 14px", lineHeight: 1.25 }}>
          {table ? `Bienvenue — Table ${table}` : "Bienvenue"}
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .4 }}
          style={{ fontSize: 14, color: MUTED, lineHeight: 1.75, margin: "0 0 36px" }}>
          {resto.description || "Découvrez notre carte et commandez directement depuis votre table."}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }}>
          <BrownBtn onClick={() => setStep("menu")}>Découvrir la carte</BrownBtn>
        </motion.div>

        {localOrders.length > 0 && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .65 }}
            onClick={() => setStep("history")}
            style={{ marginTop: 14, background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 6, margin: "14px auto 0" }}>
            <History size={13} /> Mes commandes ({localOrders.length})
          </motion.button>
        )}

        <div style={{ marginTop: 40, fontSize: 9, color: "#D4C8BC", letterSpacing: "2px", textTransform: "uppercase" }}>
          Tablière CI
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     MENU — Style BBR (liste + search + catégories pills)
  ══════════════════════════════════════════════════════════════════════ */
  if (step === "menu") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480, margin: "0 auto",
      fontFamily: FN, paddingBottom: cartCount > 0 ? 90 : 24 }}>

      {/* Header */}
      <BBRHeader restoName={resto.name} table={table} cartCount={cartCount}
        onCartClick={cartCount > 0 ? () => setStep("cart") : null} />

      {/* Photo bande */}
      <HeroBand logoUrl={resto.logo_url} restoName={resto.name} table={table} height={140} />

      {/* Search */}
      <div style={{ padding: "12px 16px 0", background: WHITE }}>
        <div style={{ position: "relative" }}>
          <Search size={15} color={MUTED} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un plat..."
            style={{ width: "100%", background: SAND, border: "none",
              borderRadius: 8, padding: "10px 12px 10px 36px", fontSize: 14,
              color: DARK, outline: "none", fontFamily: FN, boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Catégorie pills */}
      <div style={{ background: WHITE, borderBottom: `0.5px solid ${BORDER}`,
        padding: "10px 16px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
        <button onClick={() => setSelectedCat("tous")}
          style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 13, fontFamily: FN, whiteSpace: "nowrap", fontWeight: 600,
            background: selectedCat === "tous" ? DARK : SAND,
            color:      selectedCat === "tous" ? WHITE : MUTED }}>
          Tous
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
            style={{ padding: "6px 14px", borderRadius: 20, border: `0.5px solid ${BORDER}`,
              cursor: "pointer", fontSize: 13, fontFamily: FN, whiteSpace: "nowrap",
              background: selectedCat === cat.id ? DARK : WHITE,
              color:      selectedCat === cat.id ? WHITE : DARK,
              fontWeight: selectedCat === cat.id ? 600 : 400 }}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Liste des plats — style BBR */}
      <div style={{ background: WHITE }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: MUTED, fontSize: 14 }}>
            Aucun plat trouvé
          </div>
        ) : filteredItems.map((item, idx) => {
          const inCart = cart[item.id]?.qty || 0;
          const prev = filteredItems[idx-1];
          const isFirst = idx === 0 || prev?.catName !== item.catName;
          const subcat = (item.subcategory || "").trim();
          const showSubcat = subcat && (isFirst || (prev?.subcategory || "").trim() !== subcat);
          return (
            <div key={item.id}>
              {/* Séparateur catégorie si "Tous" */}
              {selectedCat === "tous" && isFirst && (
                <div style={{ padding: "10px 16px 4px", fontSize: 11, fontWeight: 700,
                  color: MUTED, textTransform: "uppercase", letterSpacing: "1.5px",
                  borderTop: idx > 0 ? `4px solid ${CREAM}` : "none" }}>
                  {item.catName}
                </div>
              )}
              {/* Sous-catégorie */}
              {showSubcat && (
                <div style={{ padding: "8px 16px 2px", fontSize: 11.5, fontWeight: 700, color: "#8a5a10" }}>
                  {subcat}
                </div>
              )}

              <div onClick={() => openItem(item)}
                style={{ display: "flex", gap: 12, padding: "14px 16px",
                  borderBottom: `0.5px solid ${BORDER}`, cursor: "pointer",
                  background: WHITE, transition: "background .1s" }}
                onMouseEnter={e => e.currentTarget.style.background = SAND}
                onMouseLeave={e => e.currentTarget.style.background = WHITE}>

                {/* Photo */}
                <div style={{ flexShrink: 0 }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} loading="lazy"
                      style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover",
                        border: `0.5px solid ${BORDER}` }}
                      onError={e => { e.target.style.display = "none"; }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 8, background: SAND,
                      display: "flex", alignItems: "center", justifyContent: "center" }}><Utensils size={24} color={BROWN} /></div>
                  )}
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: DARK,
                    fontFamily: FS, marginBottom: 3, lineHeight: 1.3 }}>
                    {item.name}
                  </div>
                  {item.description && (
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.45, marginBottom: 5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {item.description}
                    </div>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 700, color: BROWN, fontFamily: FS, fontStyle: "italic" }}>
                    {fmt(item.price)}
                  </div>
                </div>

                {/* Bouton + ou badge quantité */}
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}
                  onClick={e => e.stopPropagation()}>
                  {inCart > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => remItem(item.id)}
                        style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${BORDER}`,
                          background: WHITE, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Minus size={11} color={MUTED} />
                      </button>
                      <span style={{ fontSize: 14, fontWeight: 800, color: BROWN, minWidth: 14, textAlign: "center" }}>{inCart}</span>
                      <button onClick={() => openItem(item)}
                        style={{ width: 28, height: 28, borderRadius: "50%", border: "none",
                          background: BROWN, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Plus size={11} color={WHITE} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => openItem(item)}
                      style={{ width: 32, height: 32, borderRadius: "50%", border: "none",
                        background: BROWN, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: `0 2px 8px ${BROWN}40` }}>
                      <Plus size={15} color={WHITE} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bouton panier — centré sur tous appareils */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{ position: "fixed", bottom: 20, left: 0, right: 0, zIndex: 40,
              display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <button onClick={() => setStep("cart")}
              style={{ width: "calc(100% - 40px)", maxWidth: 420,
                padding: "15px 24px", borderRadius: 40,
                border: "none", background: BROWN, color: WHITE, fontSize: 14,
                fontWeight: 700, cursor: "pointer", fontFamily: FN,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                boxShadow: `0 6px 24px ${BROWN}55`, pointerEvents: "auto" }}>
              <span style={{ background: "rgba(255,255,255,.2)", borderRadius: "50%",
                width: 26, height: 26, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{cartCount}</span>
              <span>Voir mon panier</span>
              <span style={{ fontWeight: 900 }}>{fmt(cartTotal)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     ITEM DETAIL — Style BBR (photo grande + cuisson + note)
  ══════════════════════════════════════════════════════════════════════ */
  if (step === "item" && activeItem) {
    const opts = parseOpts(activeItem);
    const hasCuisson = opts?.cuissons?.length > 0;
    const hasAccomp  = opts?.accompagnements?.length > 0;
    const catName = categories.find(c => (c.items||[]).some(i => i.id === activeItem.id))?.name || "";
    const catItems = categories.find(c => (c.items||[]).some(i => i.id === activeItem.id))?.items || [];
    const itemIdx = catItems.findIndex(i => i.id === activeItem.id);

    return (
      <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
        margin: "0 auto", fontFamily: FN, paddingBottom: 130 }}>

        {/* Photo plein-écran */}
        <div style={{ position: "relative", height: "42vh", overflow: "hidden", background: SAND }}>
          {/* Back button */}
          <button onClick={() => setStep("menu")}
            style={{ position: "absolute", top: 16, left: 16, zIndex: 10,
              background: "rgba(255,255,255,.88)", border: "none", borderRadius: "50%",
              width: 36, height: 36, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={18} color={DARK} />
          </button>

          {activeItem.image_url ? (
            <img src={activeItem.image_url} alt={activeItem.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { e.target.style.display = "none"; }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: SAND,
              display: "flex", alignItems: "center", justifyContent: "center" }}><Utensils size={46} color={BROWN} /></div>
          )}

          {/* Dégradé bas */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
            background: `linear-gradient(to top, ${CREAM}, transparent)` }} />

          {/* Catégorie + index */}
          {catName && (
            <div style={{ position: "absolute", bottom: 14, left: 16,
              fontSize: 10, color: MUTED, letterSpacing: "1.5px", textTransform: "uppercase" }}>
              {catName}{catItems.length > 1 ? ` · ${itemIdx + 1}/${catItems.length}` : ""}
            </div>
          )}
        </div>

        {/* Contenu */}
        <div style={{ padding: "20px 20px 0" }}>
          {/* Nom */}
          <h2 style={{ fontSize: 24, fontWeight: 400, color: DARK, fontFamily: FS,
            margin: "0 0 8px", lineHeight: 1.25 }}>
            {activeItem.name}
          </h2>

          {/* Description */}
          {activeItem.description && (
            <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, margin: "0 0 20px" }}>
              {activeItem.description}
            </p>
          )}

          {/* Cuisson */}
          {hasCuisson && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED,
                textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
                Cuisson{" "}
                <span style={{ color: "#B0A090", fontWeight: 400 }}>(Requis — 1 choix)</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {opts.cuissons.map(c => (
                  <button key={c} onClick={() => setItemCuisson(c)}
                    style={{ padding: "7px 16px", borderRadius: 20, cursor: "pointer",
                      border: `1px solid ${itemCuisson === c ? BROWN : BORDER}`,
                      background: itemCuisson === c ? BROWN : WHITE,
                      color:      itemCuisson === c ? WHITE : DARK,
                      fontSize: 13, fontFamily: FN,
                      fontWeight: itemCuisson === c ? 700 : 400 }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Accompagnements */}
          {hasAccomp && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED,
                textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
                Accompagnement <span style={{ color: "#B0A090", fontWeight: 400 }}>(optionnel)</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {opts.accompagnements.map(a => (
                  <button key={a} onClick={() => setItemAccomp(itemAccomp === a ? "" : a)}
                    style={{ padding: "7px 16px", borderRadius: 20, cursor: "pointer",
                      border: `1px solid ${itemAccomp === a ? BROWN : BORDER}`,
                      background: itemAccomp === a ? BROWN : WHITE,
                      color:      itemAccomp === a ? WHITE : DARK,
                      fontSize: 13, fontFamily: FN,
                      fontWeight: itemAccomp === a ? 700 : 400 }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 8 }}>
              Note pour cet article (optionnel)
            </label>
            <textarea value={itemNote} onChange={e => setItemNote(e.target.value)}
              placeholder="Ex : bien cuit, sans sauce…" rows={3}
              style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 8,
                padding: "10px 12px", fontSize: 13, color: DARK, background: WHITE,
                outline: "none", fontFamily: FN, resize: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Barre fixe bas — centrée sur tous appareils */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
          display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 480, background: WHITE,
          borderTop: `0.5px solid ${BORDER}`, padding: "12px 16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: DARK, fontFamily: FS, fontStyle: "italic" }}>
              {fmt(activeItem.price * itemQty)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={() => setItemQty(q => Math.max(1, q-1))}
                style={{ width: 32, height: 32, borderRadius: "50%",
                  border: `1.5px solid ${BORDER}`, background: WHITE,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={13} color={MUTED} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 800, color: DARK, minWidth: 20, textAlign: "center" }}>{itemQty}</span>
              <button onClick={() => setItemQty(q => q+1)}
                style={{ width: 32, height: 32, borderRadius: "50%",
                  border: "none", background: BROWN,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={13} color={WHITE} />
              </button>
            </div>
          </div>

          <BrownBtn onClick={addItemToCart}
            disabled={hasCuisson && !itemCuisson}
            style={{ borderRadius: 8 }}>
            Ajouter au panier
          </BrownBtn>

          {hasCuisson && !itemCuisson && (
            <div style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 6 }}>
              Choisissez une cuisson pour continuer
            </div>
          )}

          <button onClick={() => setStep("menu")}
            style={{ background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: MUTED, display: "flex", alignItems: "center",
              gap: 4, padding: "8px 0 0", fontFamily: FN }}>
            <ArrowLeft size={12} /> Précédent
          </button>
        </div>
        </div> {/* ferme le wrapper flex centré */}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     PANIER
  ══════════════════════════════════════════════════════════════════════ */
  if (step === "cart") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
      margin: "0 auto", fontFamily: FN, paddingBottom: 110 }}>

      <BBRHeader restoName={resto.name} table={table} cartCount={cartCount} onBack={() => setStep("menu")} />

      <div style={{ padding: "16px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 400, fontFamily: FS, color: DARK, margin: "0 0 16px" }}>
          Mon panier
        </h2>

        {cartItems.map(({ item, qty, options }) => (
          <div key={item.id} style={{ background: WHITE, borderRadius: 12, padding: "14px 16px",
            marginBottom: 10, border: `0.5px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {item.image_url && (
                <img src={item.image_url} alt={item.name} loading="lazy"
                  style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                  onError={e => { e.target.style.display = "none"; }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: DARK, fontFamily: FS }}>{item.name}</div>
                {options?.cuisson && <div style={{ fontSize: 11, color: MUTED }}>Cuisson : {options.cuisson}</div>}
                {options?.accompagnement && <div style={{ fontSize: 11, color: MUTED }}>Avec : {options.accompagnement}</div>}
                <div style={{ fontSize: 13, color: BROWN, fontWeight: 700, fontFamily: FS, fontStyle: "italic", marginTop: 4 }}>
                  {fmt(item.price * qty)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <button onClick={() => remItem(item.id)}
                  style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${BORDER}`,
                    background: WHITE, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Minus size={11} color={MUTED} />
                </button>
                <span style={{ fontSize: 14, fontWeight: 800, color: DARK, minWidth: 16, textAlign: "center" }}>{qty}</span>
                <button onClick={() => addOne(item)}
                  style={{ width: 28, height: 28, borderRadius: "50%", border: "none",
                    background: BROWN, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={11} color={WHITE} />
                </button>
              </div>
            </div>
          </div>
        ))}

        <div style={{ background: WHITE, borderRadius: 12, padding: "16px",
          border: `0.5px solid ${BORDER}`, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            fontWeight: 800, fontSize: 17, color: DARK }}>
            <span>Total</span>
            <span style={{ color: BROWN, fontFamily: FS, fontStyle: "italic" }}>{fmt(cartTotal)}</span>
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, padding: "12px 16px 24px",
        background: `linear-gradient(to top, ${CREAM} 70%, transparent)` }}>
        <BrownBtn onClick={() => setStep("info")}>Continuer →</BrownBtn>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     INFOS CLIENT
  ══════════════════════════════════════════════════════════════════════ */
  if (step === "info") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
      margin: "0 auto", fontFamily: FN, paddingBottom: 130 }}>

      <BBRHeader restoName={resto.name} table={table} cartCount={cartCount} onBack={() => setStep("cart")} />

      <div style={{ padding: "24px 16px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 400, fontFamily: FS, color: DARK, margin: "0 0 20px" }}>
          Vos informations
        </h2>

        {[
          { label: "Nom complet *", value: clientName, set: setClientName, ph: "Jean Kouassi" },
          { label: "Téléphone", value: clientPhone, set: setClientPhone, ph: "+225 07 00 00 00 00", type: "tel" },
          { label: "Email (optionnel)", value: clientEmail, set: setClientEmail, ph: "jean@email.com", type: "email" },
        ].map(({ label, value, set, ph, type }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED,
              textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 7 }}>{label}</label>
            <input value={value} onChange={e => set(e.target.value)} placeholder={ph} type={type||"text"}
              style={{ width: "100%", background: WHITE, border: `0.5px solid ${value ? BROWN : BORDER}`,
                borderRadius: 8, padding: "13px 14px", fontSize: 15, color: DARK,
                outline: "none", fontFamily: FN, boxSizing: "border-box", transition: "border-color .2s" }} />
          </div>
        ))}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED,
            textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 7 }}>
            Notes / allergies (optionnel)
          </label>
          <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)}
            placeholder="Sans gluten, pas d'oignons…" rows={3}
            style={{ width: "100%", background: WHITE, border: `0.5px solid ${BORDER}`,
              borderRadius: 8, padding: "13px 14px", fontSize: 13, color: DARK,
              outline: "none", fontFamily: FN, resize: "none", boxSizing: "border-box" }} />
        </div>

        {/* Récap */}
        <div style={{ background: WHITE, borderRadius: 10, padding: "14px 16px",
          border: `0.5px solid ${BORDER}`, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
            letterSpacing: "1.5px", marginBottom: 10 }}>Récapitulatif</div>
          {cartItems.map(({ item, qty }) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between",
              fontSize: 13, color: DARK, marginBottom: 5 }}>
              <span style={{ color: MUTED }}>{qty}× {item.name}</span>
              <span style={{ color: BROWN, fontWeight: 600 }}>{fmt(item.price * qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between",
            fontWeight: 800, fontSize: 16, marginTop: 10, paddingTop: 10,
            borderTop: `0.5px solid ${BORDER}` }}>
            <span>Total</span>
            <span style={{ color: BROWN, fontFamily: FS, fontStyle: "italic" }}>{fmt(cartTotal)}</span>
          </div>
        </div>

        {/* Checkbox obligatoire */}
        <motion.div onClick={() => setAgreed(p => !p)}
          animate={{ borderColor: agreed ? BROWN : BORDER }}
          style={{ background: agreed ? BROWN+"0A" : WHITE, borderRadius: 10,
            padding: "14px 16px", marginBottom: 4,
            border: `1.5px solid ${agreed ? BROWN : BORDER}`,
            cursor: "pointer", transition: "all .2s" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6,
              border: `2px solid ${agreed ? BROWN : BORDER}`,
              background: agreed ? BROWN : WHITE,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1, transition: "all .2s" }}>
              {agreed && <Check size={13} color={WHITE} strokeWidth={3} />}
            </div>
            <div style={{ fontSize: 12, color: agreed ? DARK : MUTED, lineHeight: 1.65 }}>
              <strong style={{ color: agreed ? BROWN : MUTED }}>
                J'ai vérifié ma commande et je m'engage à la régler en totalité.
              </strong>{" "}
              En cas d'erreur de ma part, je suis entièrement responsable.
            </div>
          </div>
          {!agreed && (
            <div style={{ fontSize: 10, color: "#B8860B", marginTop: 7, paddingLeft: 34,
              display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={10} /> Obligatoire pour valider
            </div>
          )}
        </motion.div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, padding: "10px 16px 24px",
        background: `linear-gradient(to top, ${CREAM} 70%, transparent)`, zIndex: 20 }}>
        <BrownBtn onClick={placeOrder} disabled={submitting || !clientName.trim() || !agreed}>
          {submitting ? "Envoi en cours…" : `Confirmer · ${fmt(cartTotal)}`}
        </BrownBtn>
        {!clientName.trim() && (
          <div style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 6 }}>Votre nom est requis</div>
        )}
        {errorMsg && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#8B1414", marginTop: 8 }}>{errorMsg}</div>
        )}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     CONFIRMATION — Style BBR (photo héro + tracking statut)
  ══════════════════════════════════════════════════════════════════════ */
  if (step === "confirm") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480,
      margin: "0 auto", fontFamily: FN }}>

      {/* Photo héro avec overlay "Commande envoyée" */}
      <div style={{ position: "relative", height: 200, background: SAND, overflow: "hidden" }}>
        {resto.logo_url && (
          <img src={resto.logo_url} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .55 }}
            onError={e => { e.target.style.display = "none"; }} />
        )}
        <div style={{ position: "absolute", inset: 0,
          background: "rgba(30,18,9,.45)", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center" }}>
          {/* Logo + nom */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="rgba(255,255,255,.18)" />
              <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
              <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
              <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" fill="none"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.9)",
              letterSpacing: "1px", textTransform: "uppercase" }}>{resto.name}</span>
          </div>
          {/* Icône check */}
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22, delay: .15 }}
            style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid rgba(255,255,255,.7)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <Check size={24} color="white" strokeWidth={2.5} />
          </motion.div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "white", fontFamily: FS }}>
            Commande envoyée
          </div>
          {table && <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 4 }}>Table {table}</div>}
        </div>
      </div>

      {/* Contenu */}
      <div style={{ padding: "16px" }}>
        {/* Statut En ligne */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          background: SAND, borderRadius: 8, padding: "8px 14px", marginBottom: 12,
          fontSize: 12, color: MUTED }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50",
              animation: "pulse 2s infinite" }} />
            En ligne
          </div>
          <span>{new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

        {/* Card tracking */}
        <div style={{ background: WHITE, borderRadius: 12, padding: "16px",
          border: `0.5px solid ${BORDER}`, marginBottom: 12 }}>
          {/* Réf */}
          <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: MUTED,
            letterSpacing: "1px", textTransform: "uppercase", marginBottom: 16 }}>
            Réf. {lastOrder?.ref || "—"}
          </div>

          {/* Progression */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 0 }}>
            {[
              { label: "Reçue",    done: true },
              { label: "Acceptée", done: false },
              { label: "Prête",    done: false },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%",
                    background: s.done ? BROWN : WHITE,
                    border: `2px solid ${s.done ? BROWN : BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={13} color={s.done ? WHITE : BORDER} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: 11, color: s.done ? DARK : MUTED, fontWeight: s.done ? 600 : 400 }}>
                    {s.label}
                  </span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1.5, background: BORDER, margin: "0 4px 20px" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Détail commande */}
        <div style={{ background: WHITE, borderRadius: 12, padding: "16px",
          border: `0.5px solid ${BORDER}`, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: DARK, fontFamily: FS, marginBottom: 12 }}>
            Détail de votre commande
          </div>
          {(lastOrder?.items || []).map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between",
              fontSize: 13, color: DARK, marginBottom: 6 }}>
              <span>{it.qty}× {it.name}</span>
              <span style={{ color: MUTED }}>{fmt(it.price * it.qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between",
            fontWeight: 800, fontSize: 16, marginTop: 12, paddingTop: 12,
            borderTop: `0.5px solid ${BORDER}` }}>
            <span>Total</span>
            <span style={{ color: BROWN, fontFamily: FS, fontStyle: "italic" }}>{fmt(lastOrder?.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <button onClick={() => setLocalOrders(loadOrders())}
          style={{ width: "100%", padding: "12px 0", borderRadius: 8,
          border: `0.5px solid ${BORDER}`, background: WHITE, color: MUTED,
          fontSize: 12, cursor: "pointer", fontFamily: FN, marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <RefreshCw size={13} /> Actualiser
        </button>

        <button style={{ width: "100%", padding: "13px 0", borderRadius: 8,
          border: `1px solid ${DARK}`, background: WHITE, color: DARK,
          fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FN, marginBottom: 12 }}
          onClick={() => setStep("cart")}>
          Modifier la commande
        </button>

        <button onClick={reset}
          style={{ width: "100%", background: "none", border: "none",
            color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: FN, padding: "8px 0" }}>
          Nouvelle commande
        </button>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "#D4C8BC",
          letterSpacing: "1px", textTransform: "uppercase" }}>
          Gardez cette page ouverte — elle sera mise à jour
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     HISTORIQUE
  ══════════════════════════════════════════════════════════════════════ */
  if (step === "history") return (
    <div style={{ minHeight: "100vh", background: CREAM, maxWidth: 480, margin: "0 auto", fontFamily: FN }}>
      <BBRHeader restoName={resto.name} table={table} onBack={() => setStep("menu")} />
      <div style={{ padding: "20px 16px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 400, fontFamily: FS, color: DARK, margin: "0 0 16px" }}>
          Mes commandes
        </h2>
        {localOrders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: MUTED }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><ShoppingCart size={30} color={MUTED} /></div>
            <div>Aucune commande dans cette session</div>
          </div>
        ) : localOrders.map((o, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 12, padding: 16,
            marginBottom: 12, border: `0.5px solid ${BORDER}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: MUTED }}>
                {new Date(o.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                {o.table_label && ` · Table ${o.table_label}`}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: SAND, color: BROWN }}>
                {o.status === "en_attente" ? "Reçue" : o.status === "servi" ? "Prête" : "En cours"}
              </span>
            </div>
            {(o.items||[]).map((it, j) => (
              <div key={j} style={{ display: "flex", justifyContent: "space-between",
                fontSize: 13, color: DARK, marginBottom: 4 }}>
                <span style={{ color: MUTED }}>{it.qty}× {it.name}</span>
                <span style={{ color: BROWN, fontWeight: 600 }}>{fmt(it.price * it.qty)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between",
              fontWeight: 800, fontSize: 15, marginTop: 10, paddingTop: 10,
              borderTop: `0.5px solid ${BORDER}` }}>
              <span>Total</span>
              <span style={{ color: BROWN, fontFamily: FS, fontStyle: "italic" }}>{fmt(o.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return null;
}
