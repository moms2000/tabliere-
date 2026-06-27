import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Plus, Minus, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { MENU_CATEGORIES, fmt } from "../../utils/data";

// Page mobile — scannée via QR code
// URL: /menu/:slug?table=T4
// Thème par défaut vert TablièreCI (sera personnalisé par restaurant via admin)

const G  = "#1D9E75";
const BG = "#F5FBF8";

export default function ClientMenu() {
  const table = "T4"; // sera lu depuis URL params en prod
  const [cart,     setCart]     = useState({});
  const [step,     setStep]     = useState("menu"); // menu | cart | confirm
  const [openCats, setOpenCats] = useState({ 1: true });

  const activeItems = MENU_CATEGORIES.map(c => ({
    ...c, items: c.items.filter(i => i.active)
  })).filter(c => c.items.length > 0);

  const addItem = (item) =>
    setCart(p => ({ ...p, [item.id]: { item, qty: (p[item.id]?.qty || 0) + 1 } }));
  const removeItem = (id) =>
    setCart(p => {
      const qty = (p[id]?.qty || 0) - 1;
      if (qty <= 0) { const n = { ...p }; delete n[id]; return n; }
      return { ...p, [id]: { ...p[id], qty } };
    });

  const cartItems   = Object.values(cart);
  const cartCount   = cartItems.reduce((a, c) => a + c.qty, 0);
  const cartTotal   = cartItems.reduce((a, c) => a + c.item.price * c.qty, 0);

  const toggleCat = (id) =>
    setOpenCats(p => ({ ...p, [id]: !p[id] }));

  if (step === "confirm") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24 }}>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: G,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={34} color="white" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>
          Commande envoyée !
        </h2>
        <p style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>
          Table {table} · Votre commande a été transmise<br />à la cuisine. Merci !
        </p>
        <button onClick={() => { setCart({}); setStep("menu"); }}
          style={{ marginTop: 24, padding: "11px 28px", borderRadius: 10, border: "none",
            background: G, color: "white", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          Nouvelle commande
        </button>
      </motion.div>
    </div>
  );

  if (step === "cart") return (
    <div style={{ minHeight: "100vh", background: "#fff", maxWidth: 440, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: G, padding: "16px 16px 12px" }}>
        <button onClick={() => setStep("menu")}
          style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.8)",
            fontSize: 13, cursor: "pointer", marginBottom: 4, padding: 0 }}>← Retour</button>
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Ma commande</h2>
        <p style={{ color: "rgba(255,255,255,.7)", fontSize: 12, margin: "2px 0 0" }}>Table {table}</p>
      </div>

      <div style={{ padding: 16 }}>
        {cartItems.map(({ item, qty }) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12,
            padding: "12px 0", borderBottom: "0.5px solid #f5f5f5" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: G, fontWeight: 600 }}>{fmt(item.price)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => removeItem(item.id)}
                style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${G}`,
                  background: "white", color: G, cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={13} />
              </button>
              <span style={{ fontWeight: 600, minWidth: 20, textAlign: "center" }}>{qty}</span>
              <button onClick={() => addItem(item)}
                style={{ width: 28, height: 28, borderRadius: "50%", border: "none",
                  background: G, color: "white", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={13} />
              </button>
            </div>
            <div style={{ minWidth: 72, textAlign: "right", fontWeight: 600, fontSize: 13 }}>
              {fmt(item.price * qty)}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 16, padding: "12px 0", borderTop: "1px solid #f0f0f0",
          display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
          <span>Total</span>
          <span style={{ color: G }}>{fmt(cartTotal)}</span>
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep("confirm")}
          style={{ width: "100%", padding: 14, borderRadius: 12, border: "none",
            background: G, color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer",
            marginTop: 12 }}>
          Envoyer la commande
        </motion.button>

        <p style={{ textAlign: "center", fontSize: 11, color: "#bbb", marginTop: 10 }}>
          Le paiement se fait à la caisse
        </p>
      </div>
    </div>
  );

  // Étape principale : menu
  return (
    <div style={{ minHeight: "100vh", background: BG, maxWidth: 440, margin: "0 auto",
      paddingBottom: cartCount > 0 ? 80 : 20 }}>

      {/* Header */}
      <div style={{ background: G, padding: "18px 16px 14px" }}>
        <h1 style={{ color: "white", fontSize: 20, fontWeight: 700, margin: 0 }}>
          Le Maquis du Plateau
        </h1>
        <p style={{ color: "rgba(255,255,255,.75)", fontSize: 13, margin: "4px 0 0" }}>
          Table {table} · Bienvenue !
        </p>
      </div>

      {/* Catégories */}
      <div style={{ padding: "12px 12px 0" }}>
        {activeItems.map(cat => (
          <div key={cat.id} style={{ marginBottom: 10, background: "white",
            borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
            <button onClick={() => toggleCat(cat.id)}
              style={{ width: "100%", padding: "13px 14px", border: "none", background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{cat.name}</span>
              {openCats[cat.id] ? <ChevronUp size={16} color="#aaa" /> : <ChevronDown size={16} color="#aaa" />}
            </button>
            <AnimatePresence>
              {openCats[cat.id] && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  style={{ overflow: "hidden" }}>
                  {cat.items.map((item, i) => {
                    const qty = cart[item.id]?.qty || 0;
                    return (
                      <div key={item.id} style={{ padding: "10px 14px",
                        borderTop: "0.5px solid #f8f8f8",
                        display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: "#aaa", marginTop: 1, lineHeight: 1.3 }}>
                            {item.desc}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: G, marginTop: 4 }}>
                            {fmt(item.price)}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {qty > 0 && (
                            <button onClick={() => removeItem(item.id)}
                              style={{ width: 28, height: 28, borderRadius: "50%",
                                border: `1px solid ${G}`, background: "white",
                                color: G, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Minus size={13} />
                            </button>
                          )}
                          {qty > 0 && (
                            <span style={{ fontWeight: 700, minWidth: 16, textAlign: "center" }}>{qty}</span>
                          )}
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => addItem(item)}
                            style={{ width: 32, height: 32, borderRadius: "50%", border: "none",
                              background: G, color: "white", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Plus size={16} />
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Sticky cart button */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
              width: "100%", maxWidth: 440, padding: "12px 16px",
              background: "white", borderTop: "0.5px solid #eee" }}>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep("cart")}
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: G, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(255,255,255,.25)", borderRadius: "50%",
                  width: 24, height: 24, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{cartCount}</div>
                <span>Voir ma commande</span>
              </div>
              <span>{fmt(cartTotal)}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
