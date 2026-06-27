import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Plus, Minus, CheckCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import { menuService }   from "../../services/menu.service.js";
import { ordersService } from "../../services/orders.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";

// Page mobile — scannée via QR code
// URL: /menu/:slug?table=T4

const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "—";

export default function ClientMenu() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const table = searchParams.get("table") || "";

  const [resto,      setResto]      = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [cart,       setCart]       = useState({});
  const [step,       setStep]       = useState("menu"); // menu | cart | confirm | error
  const [openCats,   setOpenCats]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState("");

  const G     = resto?.theme_color || "#E8A045";
  const GL    = G + "1A";
  const DARK  = "#1E2E28";
  const MUTED = "#9BA89F";
  const FONT  = "'Avenir Next','Avenir','Century Gothic','Trebuchet MS',-apple-system,sans-serif";

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
        // Ouvrir la première catégorie
        if (cats.length > 0) setOpenCats({ [cats[0].id]: true });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  const addItem = (item) =>
    setCart(p => ({ ...p, [item.id]: { item, qty: (p[item.id]?.qty || 0) + 1 } }));
  const removeItem = (id) =>
    setCart(p => {
      const qty = (p[id]?.qty || 0) - 1;
      if (qty <= 0) { const n = { ...p }; delete n[id]; return n; }
      return { ...p, [id]: { ...p[id], qty } };
    });

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((a, c) => a + c.qty, 0);
  const cartTotal = cartItems.reduce((a, c) => a + c.item.price * c.qty, 0);

  const toggleCat = (id) => setOpenCats(p => ({ ...p, [id]: !p[id] }));

  const placeOrder = async () => {
    if (!resto) return;
    setSubmitting(true); setErrorMsg("");
    try {
      const items = cartItems.map(({ item, qty }) => ({
        id:    item.id,
        name:  item.name,
        price: item.price,
        qty,
      }));
      await ordersService.create({
        restaurant_id: resto.id,
        table_label:   table || undefined,
        items,
      });
      setStep("confirm");
    } catch (e) {
      setErrorMsg(e.response?.data?.message || "Impossible d'envoyer la commande. Réessayez.");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "sans-serif", color: "#9BA89F" }}>
      Chargement du menu…
    </div>
  );

  if (!resto) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "sans-serif", color: "#9BA89F", padding: 24, textAlign: "center" }}>
      Menu introuvable
    </div>
  );

  if (step === "confirm") return (
    <div style={{ minHeight: "100vh", background: GL, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ textAlign: "center", background: "white", borderRadius: 20, padding: 32,
          maxWidth: 360, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.1)" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: G,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={34} color="white" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: DARK, marginBottom: 6 }}>
          Commande envoyée !
        </h2>
        {table && (
          <div style={{ fontSize: 13, color: G, fontWeight: 600, marginBottom: 4 }}>
            Table {table}
          </div>
        )}
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 8 }}>
          Votre commande a été transmise à la cuisine.
          Merci !
        </p>
        <div style={{ background: GL, borderRadius: 10, padding: "10px 14px",
          marginBottom: 20, fontSize: 13, color: DARK }}>
          <strong style={{ color: G }}>{fmt(cartTotal)}</strong> · {cartCount} article{cartCount > 1 ? "s" : ""}
        </div>
        <button onClick={() => { setCart({}); setStep("menu"); }}
          style={{ padding: "11px 28px", borderRadius: 10, border: "none",
            background: G, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: FONT }}>
          Nouvelle commande
        </button>
      </motion.div>
    </div>
  );

  if (step === "error") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24, fontFamily: FONT }}>
      <div style={{ textAlign: "center", background: "white", borderRadius: 20,
        padding: 32, maxWidth: 360, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.1)" }}>
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

  if (step === "cart") return (
    <div style={{ minHeight: "100vh", background: "#fff", maxWidth: 440, margin: "0 auto",
      fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: G, padding: "16px 16px 12px" }}>
        <button onClick={() => setStep("menu")}
          style={{ background: "transparent", border: "none",
            color: "rgba(255,255,255,.85)", fontSize: 13, cursor: "pointer", marginBottom: 6, padding: 0 }}>
          ← Retour au menu
        </button>
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Ma commande</h2>
        {table && <p style={{ color: "rgba(255,255,255,.7)", fontSize: 12, margin: "2px 0 0" }}>Table {table}</p>}
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        {cartItems.map(({ item, qty }) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12,
            padding: "12px 0", borderBottom: "0.5px solid #f5f5f5" }}>
            {item.image_url && (
              <img src={item.image_url} alt={item.name}
                style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                onError={e => { e.target.style.display = "none"; }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{item.name}</div>
              <div style={{ fontSize: 12, color: G, fontWeight: 600 }}>{fmt(item.price)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => removeItem(item.id)}
                style={{ width: 26, height: 26, borderRadius: "50%",
                  border: `1px solid #e5e5e5`, background: "white",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={12} color={MUTED} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: DARK, minWidth: 16, textAlign: "center" }}>{qty}</span>
              <button onClick={() => addItem(item)}
                style={{ width: 26, height: 26, borderRadius: "50%",
                  border: "none", background: G,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={12} color="white" />
              </button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: DARK, minWidth: 60, textAlign: "right" }}>
              {fmt(item.price * qty)}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky footer */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 440, background: "white",
        borderTop: "0.5px solid #f0f0f0", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          marginBottom: 12, fontSize: 14 }}>
          <span style={{ color: MUTED }}>Total</span>
          <span style={{ fontWeight: 700, color: DARK }}>{fmt(cartTotal)}</span>
        </div>
        <button onClick={placeOrder} disabled={submitting}
          style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
            background: submitting ? MUTED : G, color: "white", fontSize: 14, fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer", fontFamily: FONT }}>
          {submitting ? "Envoi en cours…" : "Confirmer la commande"}
        </button>
      </div>
    </div>
  );

  // ── Menu ──
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", maxWidth: 440,
      margin: "0 auto", fontFamily: FONT, paddingBottom: cartCount > 0 ? 90 : 20 }}>

      {/* Header restaurant */}
      <div style={{ background: G, padding: "20px 16px 16px" }}>
        {resto.logo_url && (
          <img src={resto.logo_url} alt={resto.name}
            style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover",
              marginBottom: 8 }}
            onError={e => { e.target.style.display = "none"; }} />
        )}
        <h1 style={{ color: "white", fontSize: 20, fontWeight: 700, margin: "0 0 2px" }}>
          {resto.name}
        </h1>
        {table && (
          <div style={{ color: "rgba(255,255,255,.8)", fontSize: 12 }}>
            Table {table}
          </div>
        )}
        {resto.opening_hours && (
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11, marginTop: 4 }}>
            {resto.opening_hours}
          </div>
        )}
      </div>

      {/* Catégories + plats */}
      <div style={{ padding: "12px 0" }}>
        {categories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 13 }}>
            Menu non disponible
          </div>
        ) : (
          categories.map(cat => {
            const items = (cat.items || []).filter(i => i.is_active !== false && i.is_available !== false);
            if (items.length === 0) return null;
            const open = openCats[cat.id] !== false;
            return (
              <div key={cat.id} style={{ marginBottom: 4 }}>
                {/* Catégorie header */}
                <button onClick={() => toggleCat(cat.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "space-between", padding: "10px 16px",
                    background: "white", border: "none", cursor: "pointer",
                    borderBottom: open ? `2px solid ${G}` : "none",
                    fontFamily: FONT }}>
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
                                style={{ width: 70, height: 70, borderRadius: 10,
                                  objectFit: "cover", flexShrink: 0 }}
                                onError={e => { e.target.style.display = "none"; }} />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: DARK,
                                marginBottom: 3 }}>{item.name}</div>
                              {item.description && (
                                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4,
                                  marginBottom: 6 }}>{item.description}</div>
                              )}
                              <div style={{ fontSize: 14, fontWeight: 700, color: G }}>
                                {fmt(item.price)}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center",
                              flexDirection: "column", justifyContent: "flex-end", gap: 4,
                              flexShrink: 0 }}>
                              {inCart > 0 ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <button onClick={() => removeItem(item.id)}
                                    style={{ width: 28, height: 28, borderRadius: "50%",
                                      border: `1.5px solid ${G}`, background: "white",
                                      cursor: "pointer", display: "flex",
                                      alignItems: "center", justifyContent: "center" }}>
                                    <Minus size={13} color={G} />
                                  </button>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: G,
                                    minWidth: 16, textAlign: "center" }}>{inCart}</span>
                                  <button onClick={() => addItem(item)}
                                    style={{ width: 28, height: 28, borderRadius: "50%",
                                      border: "none", background: G,
                                      cursor: "pointer", display: "flex",
                                      alignItems: "center", justifyContent: "center" }}>
                                    <Plus size={13} color="white" />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => addItem(item)}
                                  style={{ width: 32, height: 32, borderRadius: "50%",
                                    border: "none", background: G,
                                    cursor: "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center",
                                    boxShadow: `0 2px 8px ${G}55` }}>
                                  <Plus size={16} color="white" />
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
          })
        )}
      </div>

      {/* Sticky cart button */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{ position: "fixed", bottom: 16, left: "50%",
              transform: "translateX(-50%)", width: "calc(100% - 32px)",
              maxWidth: 408 }}>
            <button onClick={() => setStep("cart")}
              style={{ width: "100%", padding: "14px 20px", borderRadius: 12,
                border: "none", background: G, color: "white", fontSize: 14,
                fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                boxShadow: `0 4px 20px ${G}66` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingBag size={18} />
                <span>{cartCount} article{cartCount > 1 ? "s" : ""}</span>
              </div>
              <span>{fmt(cartTotal)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
