import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Palette, CheckCircle, Eye, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn, Toggle, Badge } from "../../components/ui";
import { adminService } from "../../services/admin.service.js";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const THEMES = [
  { id: "default",  name: "Vert Ivoire",     primary: "#1D9E75", bg: "#F5FBF8", accent: "#0F6E56" },
  { id: "orange",   name: "Or TablièreCI",   primary: "#E8A045", bg: "#FEF6EC", accent: "#C47D1A" },
  { id: "ocean",    name: "Bleu Océan",      primary: "#1A6FC4", bg: "#EBF3FB", accent: "#0D4F91" },
  { id: "sunset",   name: "Coucher Soleil",  primary: "#C44B1A", bg: "#FBF0EB", accent: "#8C3412" },
  { id: "earth",    name: "Terre Ivoirienne",primary: "#A0731A", bg: "#FBF5EB", accent: "#6B4C0F" },
  { id: "night",    name: "Nuit Moderne",    primary: "#2D2D2D", bg: "#F5F5F5", accent: "#1A1A1A" },
];

const PLAN_BADGE = { premium: "green", standard: "blue", gratuit: "gray" };
const LIMIT = 50;

export default function QRThemes() {
  const [restos,     setRestos]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(null);
  const [selected,   setSelected]   = useState(null);  // resto sélectionné pour préview
  const [themeMap,   setThemeMap]   = useState({});    // restoId → themeId
  const [dropOpen,   setDropOpen]   = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");  // valeur débattue envoyée au serveur

  const totalPages = Math.ceil(total / LIMIT);

  const load = (p = 1) => {
    setLoading(true);
    // sort=name → liste alphabétique stable ; search → filtre côté serveur (1001 restos)
    adminService.listRestaurants({ limit: LIMIT, page: p, sort: "name", search: search || undefined })
      .then(res => {
        const data = res.data || [];
        setRestos(data);
        setTotal(res.pagination?.total || 0);
        if (data.length > 0 && !selected) setSelected(data[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Débounce de la recherche (300ms) → pas une requête à chaque frappe
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Retour page 1 dès qu'on change la recherche
  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => { load(page); }, [page, search]);

  const currentTheme = THEMES.find(t => t.id === (themeMap[selected?.id] || "default")) || THEMES[0];

  const applyTheme = async (themeId) => {
    if (!selected) return;
    setThemeMap(p => ({ ...p, [selected.id]: themeId }));
    try {
      const color = THEMES.find(t => t.id === themeId)?.primary || "#1D9E75";
      // Persiste theme_color en DB (l'admin passe _assertOwnerOrAdmin)
      const { default: api } = await import("../../services/api.js");
      await api.patch(`/restaurants/${selected.id}`, { theme_color: color });
    } catch (_) {}
  };

  const toggleQR = async (resto) => {
    const newActive = !resto.qr_active;
    setSaving(resto.id);
    try {
      await adminService.toggleRestaurantQR(resto.id, newActive);
      const updated = { ...resto, qr_active: newActive };
      setRestos(prev => prev.map(r => r.id === resto.id ? updated : r));
      if (selected?.id === resto.id) setSelected(updated);
    } catch (e) {
      alert(e.response?.data?.message || "Erreur lors de la mise à jour du QR");
    }
    setSaving(null);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <PageTitle title="QR Code & Thèmes" subtitle="Gérez le menu QR et les couleurs par restaurant" />
          <button onClick={() => load(page)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 9, border: "0.5px solid #eee", background: "white",
              fontSize: 12, color: "#666", cursor: "pointer" }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14, alignItems: "start" }}>

        {/* ── Gauche : activation QR par restaurant ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <motion.div variants={fadeUp}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <SectionHeader title={`Activation QR Menu — ${total} restaurants`} icon={QrCode} />
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
                    transform: "translateY(-50%)", color: "#bbb", pointerEvents: "none" }} />
                  <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    placeholder="Rechercher un restaurant…"
                    style={{ paddingLeft: 28, paddingRight: 10, height: 32, border: "0.5px solid #eee",
                      borderRadius: 8, fontSize: 12, outline: "none", color: "#333", width: 220 }} />
                </div>
              </div>
              {loading ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>Chargement…</div>
              ) : restos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: 13 }}>
                  {search ? `Aucun restaurant pour « ${search} »` : "Aucun restaurant enregistré"}
                </div>
              ) : restos.map((r, i) => {
                const active  = !!r.qr_active;
                const isSel   = selected?.id === r.id;
                const isFree  = !r.plan || r.plan === "gratuit";
                return (
                  <div key={r.id}
                    onClick={() => setSelected(r)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 10px",
                      borderRadius: 9, marginBottom: 2, cursor: "pointer",
                      background: isSel ? "#fef6ec" : i % 2 === 0 ? "white" : "#fafafa",
                      border: isSel ? "0.5px solid #f0c98a" : "0.5px solid transparent",
                      transition: "background .12s" }}>

                    {/* Indicateur statut QR */}
                    <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: active ? "#1D9E75" : "#ddd",
                      boxShadow: active ? "0 0 6px #1D9E7555" : "none" }} />

                    {/* Infos restaurant */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isSel ? 600 : 400, color: "#1e2e28",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#aaa" }}>
                        {r.quartier && `${r.quartier} · `}{r.owner_name || ""}
                      </div>
                    </div>

                    {/* Plan */}
                    <Badge label={r.plan || "gratuit"} variant={PLAN_BADGE[r.plan] || "gray"} />

                    {/* Toggle QR — admin contrôle total, tous plans */}
                    <div
                      onClick={e => { e.stopPropagation(); toggleQR(r); }}
                      title={isFree && !active ? "Activer le QR pour ce restaurant (plan gratuit)" : ""}
                      style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {saving === r.id ? (
                        <span style={{ fontSize: 10, color: "#aaa" }}>…</span>
                      ) : (
                        <>
                          {isFree && (
                            <span style={{ fontSize: 9, color: active ? "#E8A045" : "#ccc",
                              fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {active ? "Manuel" : "Off"}
                            </span>
                          )}
                          <Toggle value={active} onChange={() => {}} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ width: 30, height: 30, borderRadius: "50%", border: "0.5px solid #eee",
                      background: "white", cursor: page === 1 ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", opacity: page === 1 ? 0.4 : 1 }}>
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: 12, color: "#888" }}>Page {page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ width: 30, height: 30, borderRadius: "50%", border: "0.5px solid #eee",
                      background: "white", cursor: page === totalPages ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", opacity: page === totalPages ? 0.4 : 1 }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* ── Droite : thème + aperçu ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Sélecteur restaurant pour préview */}
          {selected && (
            <motion.div variants={fadeUp}>
              <Card>
                <SectionHeader title="Restaurant sélectionné" icon={Palette} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e2e28", marginBottom: 2 }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 12 }}>
                  Plan : <strong>{selected.plan || "gratuit"}</strong>
                </div>

                {/* Bouton activation QR rapide */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: selected.qr_active ? "#F0FBF6" : "#FFF5F5",
                  border: `0.5px solid ${selected.qr_active ? "#1D9E7544" : "#FECACA"}`,
                  borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600,
                      color: selected.qr_active ? "#1D9E75" : "#DC2626" }}>
                      QR Menu {selected.qr_active ? "activé" : "désactivé"}
                    </div>
                    <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                      {selected.qr_active
                        ? "Les clients peuvent scanner et commander"
                        : "Le menu QR est inaccessible pour ce restaurant"}
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => toggleQR(selected)}
                    disabled={saving === selected.id}
                    style={{ background: selected.qr_active ? "#DC2626" : "#1D9E75",
                      color: "white", border: "none", borderRadius: 8,
                      padding: "6px 12px", fontSize: 11, fontWeight: 700,
                      cursor: saving === selected.id ? "not-allowed" : "pointer" }}>
                    {saving === selected.id ? "…" : selected.qr_active ? "Désactiver" : "Activer"}
                  </motion.button>
                </div>
                <SectionHeader title="Thème du menu QR" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                  {THEMES.map(t => {
                    const active = (themeMap[selected.id] || "default") === t.id;
                    return (
                      <motion.div key={t.id} whileHover={{ y: -2 }} onClick={() => applyTheme(t.id)}
                        style={{ border: `1.5px solid ${active ? t.primary : "#eee"}`,
                          borderRadius: 8, padding: 8, cursor: "pointer", position: "relative",
                          background: t.bg }}>
                        {active && (
                          <div style={{ position: "absolute", top: 5, right: 5 }}>
                            <CheckCircle size={12} color={t.primary} />
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: t.primary }} />
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: t.accent }} />
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 500, color: t.primary }}>{t.name}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Aperçu menu */}
          <motion.div variants={fadeUp}>
            <Card style={{ background: currentTheme.bg }}>
              <SectionHeader title="Aperçu menu" icon={Eye} />
              <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${currentTheme.primary}22` }}>
                <div style={{ background: currentTheme.primary, padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
                    {selected?.name || "Nom du restaurant"}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", marginTop: 2 }}>
                    Table 4 · Scanner pour commander
                  </div>
                </div>
                <div style={{ padding: 10, background: "white" }}>
                  {["Attiéké Poisson Braisé","Kedjenou de Poulet","Sauce Graine"].map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between",
                      padding: "6px 0", borderBottom: "0.5px solid #f5f5f5", fontSize: 11 }}>
                      <span>{item}</span>
                      <span style={{ fontWeight: 600, color: currentTheme.primary }}>
                        {[3500, 4200, 5000][i].toLocaleString("fr-FR")} F
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, textAlign: "center" }}>
                    <div style={{ background: currentTheme.primary, color: "white", borderRadius: 6,
                      padding: "6px 0", fontSize: 11, fontWeight: 500 }}>Commander</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: "#aaa", textAlign: "center" }}>
                Le thème s'applique au menu QR du restaurant sélectionné
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
