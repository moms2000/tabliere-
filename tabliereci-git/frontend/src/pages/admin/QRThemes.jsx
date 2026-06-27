import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Palette, CheckCircle, Eye, ChevronDown } from "lucide-react";
import { Card, SectionHeader, PageTitle, Btn, Toggle, Badge } from "../../components/ui";
import { RESTAURATEURS } from "../../utils/data";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const THEMES = [
  { id: "default",  name: "Vert Ivoire",    primary: "#1D9E75", bg: "#F5FBF8", accent: "#0F6E56" },
  { id: "ocean",    name: "Bleu Océan",     primary: "#1A6FC4", bg: "#EBF3FB", accent: "#0D4F91" },
  { id: "sunset",   name: "Coucher Soleil", primary: "#C44B1A", bg: "#FBF0EB", accent: "#8C3412" },
  { id: "earth",    name: "Terre Ivoirienne",primary:"#A0731A", bg: "#FBF5EB", accent: "#6B4C0F" },
  { id: "night",    name: "Nuit Moderne",   primary: "#2D2D2D", bg: "#F5F5F5", accent: "#1A1A1A" },
  { id: "minimal",  name: "Minimal Blanc",  primary: "#888888", bg: "#FFFFFF", accent: "#444444" },
];

const PLAN_BADGE = { Premium: "green", Standard: "blue", Gratuit: "gray" };

export default function QRThemes() {
  const [selected, setSelected] = useState(null); // restaurateur sélectionné
  const [themeMap,  setThemeMap]  = useState({}); // id -> themeId
  const [qrMap,     setQrMap]     = useState(
    Object.fromEntries(RESTAURATEURS.map(r => [r.id, r.qrActive]))
  );
  const [open, setOpen] = useState(false);

  const currentResto = RESTAURATEURS.find(r => r.id === selected) || RESTAURATEURS[0];
  const currentTheme = THEMES.find(t => t.id === (themeMap[currentResto.id] || "default")) || THEMES[0];

  const applyTheme = (themeId) =>
    setThemeMap(prev => ({ ...prev, [currentResto.id]: themeId }));

  const toggleQr = (id) =>
    setQrMap(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <PageTitle title="QR Code & Thèmes" subtitle="Gérez le menu QR et les couleurs par restaurant" />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>

        {/* Sélection + thèmes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Sélecteur restaurant */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Choisir un restaurant" icon={QrCode} />
              <div style={{ position: "relative" }}>
                <button onClick={() => setOpen(p => !p)}
                  style={{ width: "100%", padding: "9px 12px", border: "0.5px solid #eee",
                    borderRadius: 8, background: "white", cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{currentResto.name}</span>
                  <ChevronDown size={14} color="#aaa" />
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                        background: "white", border: "0.5px solid #eee", borderRadius: 8,
                        boxShadow: "0 4px 16px rgba(0,0,0,.08)", zIndex: 10, overflow: "hidden" }}>
                      {RESTAURATEURS.map(r => (
                        <div key={r.id} onClick={() => { setSelected(r.id); setOpen(false); }}
                          style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13,
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            background: r.id === currentResto.id ? "#E1F5EE" : "white" }}>
                          <span>{r.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Badge label={r.plan} variant={PLAN_BADGE[r.plan]} />
                            {qrMap[r.id] && <QrCode size={12} color="#1D9E75" />}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>

          {/* Palette thèmes */}
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Thème du menu QR" icon={Palette} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {THEMES.map(t => {
                  const active = (themeMap[currentResto.id] || "default") === t.id;
                  return (
                    <motion.div key={t.id} whileHover={{ y: -2 }} onClick={() => applyTheme(t.id)}
                      style={{ border: `1.5px solid ${active ? t.primary : "#eee"}`,
                        borderRadius: 10, padding: 10, cursor: "pointer", position: "relative",
                        background: t.bg }}>
                      {active && (
                        <div style={{ position: "absolute", top: 6, right: 6 }}>
                          <CheckCircle size={14} color={t.primary} />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, background: t.primary }} />
                        <div style={{ width: 16, height: 16, borderRadius: 4, background: t.accent }} />
                        <div style={{ width: 16, height: 16, borderRadius: 4, background: t.bg,
                          border: "0.5px solid #ddd" }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: t.primary }}>{t.name}</div>
                    </motion.div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <Btn variant="primary" icon={CheckCircle}>Appliquer le thème</Btn>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Panel droit — QR toggle + préview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <motion.div variants={fadeUp}>
            <Card>
              <SectionHeader title="Activation QR Menu" icon={QrCode} />
              {RESTAURATEURS.map((r, i) => {
                const locked = r.plan === "Gratuit";
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center",
                    justifyContent: "space-between", padding: "9px 0",
                    borderBottom: i < RESTAURATEURS.length - 1 ? "0.5px solid #f8f8f8" : "none" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: "#aaa" }}>{r.plan}</div>
                    </div>
                    {locked
                      ? <span style={{ fontSize: 10, color: "#ddd" }}>Indisponible</span>
                      : <Toggle value={qrMap[r.id] || false} onChange={() => toggleQr(r.id)} />
                    }
                  </div>
                );
              })}
            </Card>
          </motion.div>

          {/* Aperçu menu */}
          <motion.div variants={fadeUp}>
            <Card style={{ background: currentTheme.bg }}>
              <SectionHeader title="Aperçu menu" icon={Eye} />
              <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${currentTheme.primary}22` }}>
                <div style={{ background: currentTheme.primary, padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{currentResto.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", marginTop: 2 }}>Table 4 · Scanner pour commander</div>
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
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
