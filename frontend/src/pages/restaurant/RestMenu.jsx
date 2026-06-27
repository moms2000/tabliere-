import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Notebook, Plus, Pencil, Trash2, QrCode } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn, Toggle } from "../../components/ui";
import { menuService }       from "../../services/menu.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const fmt = (n) => n ? n.toLocaleString("fr-FR") + " F" : "—";

export default function RestMenu() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [activeTab,  setActiveTab]  = useState(null);
  const [qrActive,   setQrActive]   = useState(false);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!user) return;
    if (!user.resto_slug) {
      setLoading(false);
      return;
    }
    Promise.all([
      menuService.getFullMenu(user.resto_slug),
      restaurantsService.getManage(user.resto_id),
    ])
      .then(([menuData, restoData]) => {
        const cats = menuData.categories || [];
        setCategories(cats);
        if (cats.length > 0) setActiveTab(cats[0].id);
        setQrActive(restoData.restaurant?.qr_active || false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.resto_slug, user?.resto_id, user]);

  const toggleItem = async (catId, itemId, currentActive) => {
    try {
      await menuService.updateItem(itemId, { is_active: !currentActive });
      setCategories(prev => prev.map(c =>
        c.id === catId ? { ...c, items: c.items.map(i =>
          i.id === itemId ? { ...i, is_active: !i.is_active } : i
        )} : c
      ));
    } catch (e) { console.error(e); }
  };

  const handleQrToggle = async (val) => {
    try {
      if (val) await restaurantsService.generateQR(user.resto_id);
      setQrActive(val);
    } catch (e) { console.error(e); }
  };

  const activeCategory = categories.find(c => c.id === activeTab);
  const totalItems     = categories.reduce((a, c) => a + (c.items?.length || 0), 0);
  const activeItems    = categories.reduce((a, c) => a + (c.items?.filter(i => i.is_active).length || 0), 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="Menu & QR Code" subtitle="Gérez votre menu et le lien QR client" />
      </motion.div>

      <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
        <Card style={{ background: qrActive ? "#E1F5EE" : "#f5f5f5", border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10,
              background: qrActive ? "#1D9E75" : "#ccc",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <QrCode size={22} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: qrActive ? "#0F6E56" : "#888" }}>
                Menu QR {qrActive ? "activé" : "désactivé"}
              </div>
              <div style={{ fontSize: 12, color: qrActive ? "#1D9E75" : "#aaa", marginTop: 2 }}>
                {qrActive
                  ? `/menu/${user?.resto_slug} · clients scannent pour voir le menu`
                  : "Activez pour permettre aux clients de voir le menu via QR"}
              </div>
            </div>
            <Toggle value={qrActive} onChange={handleQrToggle} />
          </div>
        </Card>
      </motion.div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb", fontSize: 13 }}>
          Chargement du menu…
        </div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Aucune catégorie</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Créez une catégorie pour commencer votre menu</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 14 }}>
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Catégories" />
              {categories.map(c => {
                const active = c.id === activeTab;
                return (
                  <div key={c.id} onClick={() => setActiveTab(c.id)}
                    style={{ padding: "9px 10px", borderRadius: 8, marginBottom: 2,
                      cursor: "pointer", fontSize: 13,
                      background: active ? "#E1F5EE" : "transparent",
                      color: active ? "#1D9E75" : "#555", fontWeight: active ? 500 : 400,
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{c.name}</span>
                    <span style={{ fontSize: 11, color: "#aaa" }}>{c.items?.length || 0}</span>
                  </div>
                );
              })}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid #f0f0f0" }}>
                <Btn variant="default" icon={Plus}
                  style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>
                  Catégorie
                </Btn>
              </div>
            </Card>

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Plats total",   val: totalItems },
                { label: "Plats actifs",  val: activeItems,            color: "#1D9E75" },
                { label: "Plats masqués", val: totalItems - activeItems },
              ].map((s, i) => (
                <div key={i} style={{ background: "white", border: "0.5px solid #eee",
                  borderRadius: 8, padding: "7px 10px", display: "flex",
                  justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#888" }}>{s.label}</span>
                  <span style={{ fontWeight: 600, color: s.color || "#1a1a1a" }}>{s.val}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <SectionHeader title={activeCategory?.name} icon={Notebook} />
                <Btn variant="primary" icon={Plus}>Ajouter un plat</Btn>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={activeTab}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  {(activeCategory?.items || []).map((item, i) => (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{ display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 0", borderBottom: "0.5px solid #f8f8f8",
                        opacity: item.is_active ? 1 : 0.5 }}>
                      <div style={{ width: 4, height: 36, borderRadius: 2,
                        background: item.is_active ? "#1D9E75" : "#ddd", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{item.description}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1D9E75", minWidth: 80, textAlign: "right" }}>
                        {fmt(item.price)}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <Toggle value={item.is_active}
                          onChange={() => toggleItem(activeCategory.id, item.id, item.is_active)} />
                        <button style={{ border: "none", background: "transparent", cursor: "pointer", color: "#bbb", display: "flex" }}>
                          <Pencil size={14} />
                        </button>
                        <button style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ddd", display: "flex" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {(activeCategory?.items || []).length === 0 && (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
                      Aucun plat dans cette catégorie
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
