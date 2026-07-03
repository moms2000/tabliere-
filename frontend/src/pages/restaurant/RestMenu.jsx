import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { Notebook, Plus, Pencil, Trash2, QrCode, ExternalLink, Copy, Check, Share2 } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn, Toggle, Modal, FormField, Input, PhotoUpload } from "../../components/ui";
import { menuService }        from "../../services/menu.service.js";
import { restaurantsService } from "../../services/restaurants.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };
const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "—";

/* ── QR Code réel (react-qr-code) ───────────────────────────────────────────── */
function QrSvg({ url, size = 140, dark = DARK, light = "white" }) {
  return (
    <div style={{ background: "white", padding: 8, borderRadius: 8, display: "inline-block" }}>
      <QRCode value={url || "https://tabliereci.net"} size={size} fgColor={dark} bgColor={light} />
    </div>
  );
}

// Normalise une valeur d'options (tableau OU chaîne legacy "Saignant!Biencuit")
// vers un tableau de choix propres. Gère les anciens séparateurs , ; ! saut de ligne.
function normalizeChoices(val) {
  if (Array.isArray(val)) {
    return val.flatMap(s => String(s).split(/[,;!\n]/)).map(s => s.trim()).filter(Boolean);
  }
  if (typeof val === "string") {
    return val.split(/[,;!\n]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// Éditeur de choix répétables (une bulle par choix) avec bouton "Ajouter"
function OptionEditor({ label, addLabel, placeholder, items, onChange }) {
  const list = Array.isArray(items) ? items : [];
  const setAt    = (i, v) => onChange(list.map((x, idx) => (idx === i ? v : x)));
  const removeAt = (i)    => onChange(list.filter((_, idx) => idx !== i));
  const add      = ()     => onChange([...list, ""]);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 8 }}>{label}</div>
      {list.length === 0 && (
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
          Aucun choix pour l'instant.
        </div>
      )}
      {list.map((val, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <Input value={val} onChange={e => setAt(i, e.target.value)} placeholder={placeholder} />
          </div>
          <button type="button" onClick={() => removeAt(i)} aria-label="Supprimer ce choix"
            style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, border: `1px solid ${BORDER}`,
              background: "white", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#DC2626" }}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
          borderRadius: 8, border: `1px dashed ${MUTED}`, background: "transparent", cursor: "pointer",
          color: DARK, fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

export default function RestMenu() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [categories, setCategories] = useState([]);
  const [activeTab,  setActiveTab]  = useState(null);
  const [qrActive,   setQrActive]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [copied,     setCopied]     = useState(false);
  const [modalCat,   setModalCat]   = useState(false);
  const [modalItem,  setModalItem]  = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [editCat,    setEditCat]    = useState(null);
  const [formCat,    setFormCat]    = useState({ name: "" });
  const [formItem,   setFormItem]   = useState({ name: "", description: "", price: "", image_url: "", is_active: true, options: { cuissons: [], accompagnements: [] } });

  const menuUrl = `${window.location.origin}/menu/${user?.resto_slug || ""}`;

  useEffect(() => {
    if (!user?.resto_slug) { setLoading(false); return; }
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
  }, [user?.resto_slug, user?.resto_id]);

  const toggleItem = async (catId, itemId, cur) => {
    try {
      await menuService.updateItem(itemId, { is_active: !cur });
      setCategories(prev => prev.map(c => c.id === catId
        ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, is_active: !i.is_active } : i) } : c));
    } catch (e) { console.error(e); }
  };

  const handleQrToggle = async (val) => {
    try {
      if (val) {
        // Activer → générer le QR code
        await restaurantsService.generateQR(user.resto_id);
      } else {
        // Désactiver → persister en DB via PATCH
        await restaurantsService.update(user.resto_id, { qr_active: false });
      }
      setQrActive(val);
    } catch (e) { console.error(e); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(menuUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const saveCat = async () => {
    try {
      if (editCat) {
        await menuService.updateCategory(editCat.id, formCat);
        setCategories(prev => prev.map(c => c.id === editCat.id ? { ...c, ...formCat } : c));
      } else {
        const res = await menuService.createCategory(user.resto_id, formCat);
        const n = res.category || { id: Date.now(), ...formCat, items: [] };
        setCategories(prev => [...prev, n]);
        if (!activeTab) setActiveTab(n.id);
      }
    } catch (e) { console.error(e); }
    setModalCat(false); setEditCat(null); setFormCat({ name: "" });
  };

  const deleteCat = async (id) => {
    if (!window.confirm("Supprimer cette catégorie et tous ses plats ?")) return;
    try {
      await menuService.deleteCategory(id);
      const rem = categories.filter(c => c.id !== id);
      setCategories(rem);
      if (activeTab === id) setActiveTab(rem[0]?.id || null);
    } catch (e) { console.error(e); }
  };

  const saveItem = async () => {
    // Nettoyer les choix : retirer les lignes vides ajoutées mais non remplies
    const clean = (arr) => (Array.isArray(arr) ? arr.map(s => String(s).trim()).filter(Boolean) : []);
    const options = {
      cuissons:        clean(formItem.options?.cuissons),
      accompagnements: clean(formItem.options?.accompagnements),
    };
    const payload = { ...formItem, options, price: Number(formItem.price) };
    try {
      if (editItem) {
        await menuService.updateItem(editItem.id, payload);
        setCategories(prev => prev.map(c => c.id === activeTab
          ? { ...c, items: c.items.map(i => i.id === editItem.id ? { ...i, ...payload } : i) } : c));
      } else {
        const res = await menuService.createItem({ ...payload, category_id: activeTab });
        const n = res.item || { id: Date.now(), ...payload };
        setCategories(prev => prev.map(c => c.id === activeTab
          ? { ...c, items: [...(c.items || []), n] } : c));
      }
    } catch (e) { console.error(e); }
    setModalItem(false); setEditItem(null);
    setFormItem({ name: "", description: "", price: "", image_url: "", is_active: true, options: { cuissons: [], accompagnements: [] } });
  };

  const deleteItem = async (catId, itemId) => {
    if (!window.confirm("Supprimer ce plat ?")) return;
    try {
      await menuService.deleteItem(itemId);
      setCategories(prev => prev.map(c => c.id === catId
        ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c));
    } catch (e) { console.error(e); }
  };

  const openEditCat  = (cat)  => { setEditCat(cat); setFormCat({ name: cat.name }); setModalCat(true); };
  const openNewCat   = ()     => { setEditCat(null); setFormCat({ name: "" }); setModalCat(true); };
  const openEditItem = (item) => {
    setEditItem(item);
    let parsedOpts = { cuissons: [], accompagnements: [] };
    try { parsedOpts = typeof item.options === "string" ? JSON.parse(item.options) : (item.options || parsedOpts); } catch(_) {}
    // Normaliser (gère les données legacy "Saignant!Biencuit" collées en une bulle)
    const options = {
      cuissons:        normalizeChoices(parsedOpts?.cuissons),
      accompagnements: normalizeChoices(parsedOpts?.accompagnements),
    };
    setFormItem({ name: item.name, description: item.description || "", price: item.price, image_url: item.image_url || "", is_active: item.is_active, options });
    setModalItem(true);
  };
  const openNewItem  = ()     => {
    setEditItem(null); setFormItem({ name: "", description: "", price: "", image_url: "", is_active: true, options: { cuissons: [], accompagnements: [] } }); setModalItem(true);
  };

  const activeCategory = categories.find(c => c.id === activeTab);
  const totalItems     = categories.reduce((a, c) => a + (c.items?.length || 0), 0);
  const activeItems    = categories.reduce((a, c) => a + (c.items?.filter(i => i.is_active).length || 0), 0);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ fontFamily: FONT }}>
      <motion.div variants={fadeUp}>
        <PageTitle title="Menu & QR Code" subtitle="Gérez votre menu et le lien QR client" />
      </motion.div>

      {/* Bannière QR */}
      <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
        <div style={{ background: qrActive ? DARK : BG, border: `0.5px solid ${qrActive ? "transparent" : BORDER}`,
          borderRadius: 14, padding: "18px 22px",
          display: "flex", alignItems: "center", gap: 16, transition: "background .3s" }}>
          <div style={{ width: 42, height: 42, borderRadius: 10,
            background: qrActive ? P + "33" : BORDER,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <QrCode size={22} color={qrActive ? P : MUTED} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: qrActive ? "white" : DARK, marginBottom: 2 }}>
              Menu QR {qrActive ? "— Activé" : "— Désactivé"}
            </div>
            <div style={{ fontSize: 12, color: qrActive ? "rgba(255,255,255,.45)" : MUTED }}>
              {qrActive ? menuUrl : "Activez pour permettre aux clients de scanner et voir le menu"}
            </div>
          </div>
          {qrActive && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copyLink}
                style={{ display: "flex", alignItems: "center", gap: 5,
                  border: "0.5px solid rgba(255,255,255,.2)", borderRadius: 8,
                  padding: "6px 12px", background: "transparent",
                  color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copié !" : "Copier"}
              </button>
              <button onClick={() => window.open(menuUrl, "_blank")}
                style={{ display: "flex", alignItems: "center", gap: 5,
                  border: "none", borderRadius: 8, padding: "7px 14px",
                  background: P, color: "#1A1000", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: FONT }}>
                <ExternalLink size={13} />Aperçu
              </button>
            </div>
          )}
          <Toggle value={qrActive} onChange={handleQrToggle} />
        </div>
      </motion.div>

      {/* QR Code visuel */}
      <AnimatePresence>
        {qrActive && (
          <motion.div variants={fadeUp} style={{ marginBottom: 14 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <SectionHeader title="QR Code à imprimer / partager" icon={QrCode} />
              <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ background: "white", padding: 14, borderRadius: 10,
                  border: `0.5px solid ${BORDER}`, display: "inline-flex" }}>
                  <QrSvg url={menuUrl} size={140} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: DARK, marginBottom: 6 }}>
                    Lien direct
                  </div>
                  <code style={{ fontSize: 12, color: MUTED, background: BG,
                    padding: "4px 10px", borderRadius: 6, display: "block", marginBottom: 14 }}>
                    {menuUrl}
                  </code>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn onClick={copyLink} icon={copied ? Check : Copy}>
                      {copied ? "Copié !" : "Copier le lien"}
                    </Btn>
                    <Btn variant="primary" icon={Share2}
                      onClick={() => {
                        if (navigator.share) navigator.share({ title: "Notre menu", url: menuUrl });
                        else copyLink();
                      }}>
                      Partager
                    </Btn>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontSize: 13 }}>Chargement…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "210px 1fr", gap: 14 }}>

          {/* Catégories */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Catégories" />
              {categories.length === 0 && (
                <div style={{ fontSize: 12, color: MUTED, textAlign: "center", padding: "10px 0" }}>
                  Aucune catégorie
                </div>
              )}
              {categories.map(c => {
                const active = c.id === activeTab;
                return (
                  <div key={c.id} onClick={() => setActiveTab(c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 9px",
                      borderRadius: 8, marginBottom: 2, cursor: "pointer",
                      background: active ? PL : "transparent",
                      borderLeft: active ? `3px solid ${P}` : "3px solid transparent" }}>
                    <span style={{ fontSize: 13, flex: 1,
                      color: active ? "#C47D1A" : DARK, fontWeight: active ? 600 : 400 }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: 10, color: MUTED }}>{c.items?.length || 0}</span>
                    <button onClick={e => { e.stopPropagation(); openEditCat(c); }}
                      style={{ border: "none", background: "transparent",
                        cursor: "pointer", color: MUTED, display: "flex", padding: 2 }}>
                      <Pencil size={11} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteCat(c.id); }}
                      style={{ border: "none", background: "transparent",
                        cursor: "pointer", color: "#FECACA", display: "flex", padding: 2 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${BORDER}` }}>
                <Btn variant="default" icon={Plus} onClick={openNewCat}
                  style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>
                  Catégorie
                </Btn>
              </div>
            </Card>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Total", val: totalItems },
                { label: "Actifs", val: activeItems, color: S },
                { label: "Masqués", val: totalItems - activeItems },
              ].map((s, i) => (
                <div key={i} style={{ background: "white", border: `0.5px solid ${BORDER}`,
                  borderRadius: 8, padding: "7px 10px", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: MUTED }}>{s.label}</span>
                  <span style={{ fontWeight: 600, color: s.color || DARK }}>{s.val}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Plats */}
          <motion.div variants={fadeUp}>
            <Card>
              <div style={{ display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 14 }}>
                <SectionHeader title={activeCategory?.name || "Sélectionnez une catégorie"} icon={Notebook} />
                {activeTab && <Btn variant="primary" icon={Plus} onClick={openNewItem}>Ajouter un plat</Btn>}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  {(activeCategory?.items || []).map((item, i) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 0", borderBottom: `0.5px solid ${BG}`,
                      opacity: item.is_active ? 1 : 0.45 }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name}
                          style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                          onError={e => { e.target.style.display = "none"; }} />
                      ) : (
                        <div style={{ width: 4, height: 38, borderRadius: 2,
                          background: item.is_active ? P : BORDER, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: DARK }}>{item.name}</div>
                        {item.description && (
                          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{item.description}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: P, minWidth: 80, textAlign: "right" }}>
                        {fmt(item.price)}
                      </div>
                      <Toggle value={item.is_active}
                        onChange={() => toggleItem(activeCategory.id, item.id, item.is_active)} />
                      <button onClick={() => openEditItem(item)}
                        style={{ border: "none", background: "transparent",
                          cursor: "pointer", color: MUTED, display: "flex", padding: 4 }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteItem(activeCategory.id, item.id)}
                        style={{ border: "none", background: "transparent",
                          cursor: "pointer", color: "#FECACA", display: "flex", padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {(activeCategory?.items || []).length === 0 && activeTab && (
                    <div style={{ textAlign: "center", padding: "36px 0", color: MUTED, fontSize: 13 }}>
                      <div style={{ marginBottom: 12 }}>Aucun plat</div>
                      <Btn variant="primary" icon={Plus} onClick={openNewItem}
                        style={{ margin: "0 auto" }}>Premier plat</Btn>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Modal catégorie */}
      {modalCat && (
        <Modal open title={editCat ? "Modifier la catégorie" : "Nouvelle catégorie"}
          onClose={() => { setModalCat(false); setEditCat(null); }}>
          <FormField label="Nom">
            <Input value={formCat.name}
              onChange={e => setFormCat(p => ({ ...p, name: e.target.value }))}
              placeholder="Entrées, Plats, Desserts…" />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => { setModalCat(false); setEditCat(null); }}>Annuler</Btn>
            <Btn variant="primary" onClick={saveCat} disabled={!formCat.name}>
              {editCat ? "Enregistrer" : "Créer"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal plat */}
      {modalItem && (
        <Modal open title={editItem ? "Modifier le plat" : "Nouveau plat"}
          onClose={() => { setModalItem(false); setEditItem(null); }} width={520}>
          <FormField label="Nom du plat">
            <Input value={formItem.name}
              onChange={e => setFormItem(p => ({ ...p, name: e.target.value }))}
              placeholder="Poulet grillé sauce graine…" />
          </FormField>
          <FormField label="Description (optionnel)">
            <textarea value={formItem.description}
              onChange={e => setFormItem(p => ({ ...p, description: e.target.value }))}
              placeholder="Ingrédients, allergènes, note…" rows={3}
              style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
                padding: "9px 12px", fontSize: 13, color: DARK, background: BG,
                outline: "none", fontFamily: FONT, resize: "vertical", boxSizing: "border-box" }} />
          </FormField>
          <PhotoUpload
            label="Photo du plat"
            value={formItem.image_url}
            onChange={b64 => setFormItem(p => ({ ...p, image_url: b64 }))}
            height={110}
          />
          <FormField label="">
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              La photo est compressée automatiquement depuis votre appareil.
            </div>
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <FormField label="Prix (FCFA)">
              <Input value={formItem.price} type="number"
                onChange={e => setFormItem(p => ({ ...p, price: e.target.value }))}
                placeholder="4500" />
            </FormField>
            <FormField label="Disponibilité">
              <label style={{ display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", height: 40 }}>
                <Toggle value={formItem.is_active}
                  onChange={v => setFormItem(p => ({ ...p, is_active: v }))} />
                <span style={{ fontSize: 13, color: formItem.is_active ? DARK : MUTED, fontFamily: FONT }}>
                  {formItem.is_active ? "Disponible" : "Masqué"}
                </span>
              </label>
            </FormField>
          </div>

          {/* Options cuisson et accompagnements */}
          <div style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase",
              letterSpacing: "0.8px", marginBottom: 10 }}>Options client (optionnel)</div>
            <OptionEditor
              label="Cuissons disponibles"
              addLabel="Ajouter une cuisson"
              placeholder="Ex : Saignant"
              items={formItem.options?.cuissons || []}
              onChange={(arr) => setFormItem(p => ({ ...p, options: { ...p.options, cuissons: arr } }))}
            />
            <OptionEditor
              label="Accompagnements disponibles"
              addLabel="Ajouter un accompagnement"
              placeholder="Ex : Frites"
              items={formItem.options?.accompagnements || []}
              onChange={(arr) => setFormItem(p => ({ ...p, options: { ...p.options, accompagnements: arr } }))}
            />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => { setModalItem(false); setEditItem(null); }}>Annuler</Btn>
            <Btn variant="primary" onClick={saveItem} disabled={!formItem.name || !formItem.price}>
              {editItem ? "Enregistrer" : "Ajouter"}
            </Btn>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}
