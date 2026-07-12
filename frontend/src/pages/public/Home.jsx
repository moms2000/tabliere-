import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { usePageMeta } from "../../hooks/usePageMeta.js";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Star, MapPin, Music, Sunrise, Gift, UtensilsCrossed,
  Bookmark, User, LogOut, Globe, CheckCircle, ChevronDown, BookOpen, Sparkles,
  Calendar, Clock, Users, ChevronLeft, ChevronRight, Plus, Minus, Bell,
  TrendingUp, Shield, Smartphone, WifiOff, RefreshCw,
} from "lucide-react";
import HomeMobile from "./HomeMobile.jsx";
import { restaurantsService } from "../../services/restaurants.service.js";
import { usersService } from "../../services/users.service.js";
import api from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
const MapView = lazy(() => import("../../components/MapView.jsx"));
import { useLang } from "../../context/LanguageContext.jsx";

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const P      = "#E8A045";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const WHITE  = "#FFFFFF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";
const CARD_ACCENT = [P, S, DARK, "#B07A3A", "#5A8A6A", "#2E4A3A"];

// Créneaux affichés sur les cartes (style OpenTable) — format aligné sur RestaurantDetail
const CARD_SLOTS = ["19h00", "19h30", "20h00", "20h30"];
const DESKTOP_TIMES = ["12h00","12h30","13h00","13h30","14h00","19h00","19h30","20h00","20h30","21h00","21h30","22h00"];
const timeToMin = (s) => { const [h, m] = String(s).replace("h", ":").split(":").map(Number); return h * 60 + (m || 0); };
// Créneaux d'une carte : partent DIRECTEMENT de l'heure choisie dans la barre
// de recherche → reflètent visiblement le filtre (l'étape résa gère le passé).
function dynamicSlots(selTime) {
  const base = timeToMin(selTime || "19:00");
  let pool = DESKTOP_TIMES.filter((s) => timeToMin(s) >= base);
  if (pool.length === 0) pool = DESKTOP_TIMES.slice(-4);
  return pool.slice(0, 4);
}
function slotIsPast(dateIso, slot) {
  const today = new Date().toISOString().split("T")[0];
  if (dateIso !== today) return false;
  const [h, m] = slot.replace("h", ":").split(":").map(Number);
  const now = new Date();
  return h < now.getHours() || (h === now.getHours() && (m || 0) <= now.getMinutes());
}
// Badge de mise en avant selon la popularité / nouveauté du restaurant
function cardBadge(r) {
  if ((r.review_count || 0) >= 5 || (r.rating || 0) >= 4.8) return { label: "Populaire", bg: "#1E2E28" };
  if (!r.review_count) return { label: "Nouveau", bg: P };
  return null;
}

// Squelette de carte pendant le chargement (perçu plus rapide, plus pro)
function SkeletonCard() {
  const bar = (w, h = 12) => ({
    width: w, height: h, borderRadius: 5, marginBottom: 8,
    background: "linear-gradient(90deg,#efeae2 25%,#f6f2ec 50%,#efeae2 75%)",
    backgroundSize: "200% 100%", animation: "tci-shimmer 1.3s infinite",
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", border: `0.5px solid ${BORDER}`,
      borderRadius: 12, overflow: "hidden", marginBottom: 10, background: WHITE }}>
      <div style={{ minHeight: 110, background: "linear-gradient(90deg,#efeae2 25%,#f6f2ec 50%,#efeae2 75%)",
        backgroundSize: "200% 100%", animation: "tci-shimmer 1.3s infinite" }} />
      <div style={{ padding: "14px 16px" }}>
        <div style={bar("40%", 9)} />
        <div style={bar("70%", 15)} />
        <div style={bar("50%")} />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <div style={bar(52, 26)} /><div style={bar(52, 26)} /><div style={bar(52, 26)} />
        </div>
      </div>
    </div>
  );
}

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR   = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const LANG_LABELS = { fr: "Français", en: "English", ar: "العربية" };
const LANG_SHORT  = { fr: "FR", en: "EN", ar: "AR" };

/* ── Logo SVG ────────────────────────────────────────────────────────────────── */
function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={P} />
      <rect x="9" y="12" width="22" height="2.5" rx="1.25" fill="white" />
      <rect x="17" y="14.5" width="6" height="13" rx="1.5" fill="white" />
      <path d="M9 24.5 Q15.5 28.5 20 24.5 Q24.5 20.5 31 24.5"
        stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

/* ── Décor hero SVG ──────────────────────────────────────────────────────────── */
function HeroDecor() {
  return (
    <svg viewBox="0 0 460 340" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}>
      {/* Fond sable doux */}
      <rect width="460" height="340" fill="#F0EBE1" rx="16" />

      {/* Grande assiette principale */}
      <circle cx="230" cy="170" r="110" fill="white" stroke={BORDER} strokeWidth="1" />
      <circle cx="230" cy="170" r="88"  fill={BG}   stroke={BORDER} strokeWidth="0.5" />
      <circle cx="230" cy="170" r="58"  fill="white" stroke={BORDER} strokeWidth="0.5" />

      {/* Fourchette gauche */}
      <rect x="113" y="100" width="3" height="80" rx="1.5" fill={MUTED} opacity="0.5" />
      <rect x="108" y="100" width="2" height="40" rx="1"   fill={MUTED} opacity="0.4" />
      <rect x="118" y="100" width="2" height="40" rx="1"   fill={MUTED} opacity="0.4" />
      <rect x="113" y="140" width="8"  height="2"  rx="1"   fill={MUTED} opacity="0.4" />

      {/* Couteau droit */}
      <rect x="344" y="100" width="3" height="80" rx="1.5" fill={MUTED} opacity="0.5" />
      <path d="M347 100 C352 108 352 118 347 122 L347 100Z" fill={MUTED} opacity="0.35" />

      {/* Cuillère haut-droite */}
      <circle cx="334" cy="88" r="10" fill="none" stroke={P} strokeWidth="1.5" opacity="0.5" />
      <rect x="333" y="97" width="2.5" height="28" rx="1.25" fill={P} opacity="0.45" />

      {/* Herbe déco sur assiette */}
      <ellipse cx="210" cy="165" rx="14" ry="8" fill={S} opacity="0.25" />
      <ellipse cx="248" cy="168" rx="10" ry="6" fill={P} opacity="0.3" />
      <ellipse cx="226" cy="178" rx="8"  ry="5" fill={DARK} opacity="0.12" />

      {/* Verre vin gauche */}
      <path d="M75 80 L85 80 L84 112 L82 116 L82 140 L78 140 L78 116 L76 112Z"
        fill="none" stroke={S} strokeWidth="1.5" opacity="0.5" />
      <path d="M76 92 Q80 104 84 92" fill={S} opacity="0.15" stroke="none" />

      {/* Verre eau droite */}
      <rect x="368" y="130" width="20" height="36" rx="4" fill="none" stroke={P} strokeWidth="1.5" opacity="0.45" />
      <path d="M368 142 L388 142" stroke={P} strokeWidth="0.5" opacity="0.3" />
      <ellipse cx="378" cy="138" rx="5" ry="2" fill={P} opacity="0.1" />

      {/* Motif wax coin haut gauche */}
      <g opacity="0.12">
        <circle cx="40"  cy="40"  r="18" fill={P} />
        <circle cx="70"  cy="30"  r="10" fill={S} />
        <circle cx="30"  cy="70"  r="10" fill={S} />
        <circle cx="60"  cy="60"  r="6"  fill={DARK} />
      </g>

      {/* Motif wax coin bas droite */}
      <g opacity="0.1">
        <circle cx="420" cy="300" r="22" fill={S} />
        <circle cx="445" cy="280" r="12" fill={P} />
        <circle cx="400" cy="320" r="12" fill={P} />
        <circle cx="425" cy="310" r="7"  fill={DARK} />
      </g>

      {/* Petits points décoratifs */}
      {[40,80,120,160,200,240,280,320,360,400].map((x, i) =>
        i % 2 === 0
          ? <circle key={x} cx={x} cy={330} r="2" fill={P} opacity="0.2" />
          : <circle key={x} cx={x} cy={330} r="2" fill={S} opacity="0.2" />
      )}

      {/* Badge disponibilité */}
      <rect x="148" y="50" width="164" height="32" rx="16" fill={DARK} />
      <circle cx="168" cy="66" r="5" fill={S} />
      <rect x="178" y="62" width="80" height="3"  rx="1.5" fill="white" opacity="0.7" />
      <rect x="178" y="69" width="50" height="2.5" rx="1.25" fill="white" opacity="0.35" />
      <rect x="268" y="60" width="30" height="12" rx="6" fill={P} />
      <rect x="274" y="64" width="18" height="2" rx="1" fill={DARK} />
      <rect x="276" y="68" width="14" height="2" rx="1" fill={DARK} />

      {/* Badge note */}
      <rect x="310" y="190" width="100" height="44" rx="10" fill="white" stroke={BORDER} strokeWidth="0.5" />
      <rect x="320" y="200" width="12" height="12" rx="6" fill="#FEF6EC" />
      <path d="M326 200 L327.5 204 L332 204 L328.5 207 L330 211 L326 208.5 L322 211 L323.5 207 L320 204 L324.5 204Z"
        fill={P} />
      <rect x="337" y="202" width="30" height="2.5" rx="1.25" fill={DARK} opacity="0.7" />
      <rect x="337" y="208" width="20" height="2" rx="1"    fill={MUTED} opacity="0.5" />
      <rect x="320" y="218" width="80" height="2" rx="1" fill={BG} />
      <rect x="320" y="224" width="55" height="2" rx="1" fill={BG} />

      {/* Badge réservation */}
      <rect x="50" y="200" width="110" height="44" rx="10" fill="white" stroke={BORDER} strokeWidth="0.5" />
      <rect x="60" y="210" width="14" height="14" rx="7" fill="#FEF6EC" />
      <path d="M67 213 L67 220 M64 216 L70 216" stroke={P} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="80" y="212" width="45" height="2.5" rx="1.25" fill={DARK} opacity="0.7" />
      <rect x="80" y="218" width="35" height="2"   rx="1"    fill={MUTED} opacity="0.5" />
      <rect x="60" y="228" width="90" height="2" rx="1" fill={S} opacity="0.5" />
      <rect x="60" y="234" width="60" height="2" rx="1" fill={BG} />
    </svg>
  );
}

/* ── Calendrier custom ───────────────────────────────────────────────────────── */
function CalendarDropdown({ value, onChange, onClose }) {
  const today   = new Date();
  const sel     = value ? new Date(value + "T00:00:00") : null;
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isPast  = (d) => !d || new Date(year, month, d) < todayStart;
  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
  const isSel   = (d) => sel && d && year === sel.getFullYear() && month === sel.getMonth() && d === sel.getDate();

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  const pick = (d) => {
    if (isPast(d)) return;
    const str = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    onChange(str);
    onClose();
  };

  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
      background: WHITE, border: `0.5px solid ${BORDER}`, borderRadius: 14,
      boxShadow: "0 8px 32px rgba(30,46,40,.13)", padding: 16, width: 300, fontFamily: FONT }}>

      {/* Header mois */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={prev} style={iconBtn}><ChevronLeft size={16} /></button>
        <span style={{ fontSize: 14, fontWeight: 600, color: DARK }}>
          {MONTHS_FR[month]} {year}
        </span>
        <button onClick={next} style={iconBtn}><ChevronRight size={16} /></button>
      </div>

      {/* Jours */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 6 }}>
        {DAYS_FR.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600,
            color: MUTED, letterSpacing: "0.5px", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Cellules */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((d, i) => (
          <button key={i} onClick={() => pick(d)} disabled={!d || isPast(d)}
            style={{ height: 34, borderRadius: 7, border: "none", cursor: d && !isPast(d) ? "pointer" : "default",
              fontSize: 13, fontFamily: FONT,
              background: isSel(d) ? P : isToday(d) ? "#FEF6EC" : "transparent",
              color: isSel(d) ? "#1A1000" : isPast(d) ? BORDER : DARK,
              fontWeight: isSel(d) || isToday(d) ? 600 : 400,
              outline: isToday(d) && !isSel(d) ? `1.5px solid ${P}` : "none",
              opacity: !d ? 0 : 1,
              transition: "background .12s" }}>
            {d || ""}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Dropdown temps ──────────────────────────────────────────────────────────── */
const TIME_SLOTS = [
  "11:30","12:00","12:30","13:00","13:30","14:00",
  "18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00",
];

function TimeDropdown({ value, onChange, onClose }) {
  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
      background: WHITE, border: `0.5px solid ${BORDER}`, borderRadius: 14,
      boxShadow: "0 8px 32px rgba(30,46,40,.13)", overflow: "hidden",
      width: 160, maxHeight: 280, overflowY: "auto", fontFamily: FONT }}>
      {TIME_SLOTS.map(h => (
        <button key={h} onClick={() => { onChange(h); onClose(); }}
          style={{ display: "block", width: "100%", padding: "10px 18px", border: "none",
            background: value === h ? "#FEF6EC" : "transparent",
            color: value === h ? "#C47D1A" : DARK, fontWeight: value === h ? 600 : 400,
            fontSize: 13, textAlign: "left", cursor: "pointer", fontFamily: FONT,
            borderLeft: value === h ? `3px solid ${P}` : "3px solid transparent" }}>
          {h}
        </button>
      ))}
    </div>
  );
}

/* ── Dropdown guests ─────────────────────────────────────────────────────────── */
function GuestsDropdown({ value, onChange, onClose }) {
  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
      background: WHITE, border: `0.5px solid ${BORDER}`, borderRadius: 14,
      boxShadow: "0 8px 32px rgba(30,46,40,.13)", padding: 20, fontFamily: FONT, width: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED,
        letterSpacing: "1px", textTransform: "uppercase", marginBottom: 16 }}>
        Nombre de personnes
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => value > 1 && onChange(value - 1)}
          style={{ width: 36, height: 36, borderRadius: "50%", border: `0.5px solid ${BORDER}`,
            background: value > 1 ? WHITE : BG, cursor: value > 1 ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", color: DARK }}>
          <Minus size={14} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 300, color: DARK, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {value === 1 ? "personne" : "personnes"}
          </div>
        </div>
        <button onClick={() => value < 20 && onChange(value + 1)}
          style={{ width: 36, height: 36, borderRadius: "50%", border: `0.5px solid ${BORDER}`,
            background: value < 20 ? WHITE : BG, cursor: value < 20 ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", color: DARK }}>
          <Plus size={14} />
        </button>
      </div>
      <button onClick={onClose}
        style={{ marginTop: 16, width: "100%", background: P, color: "#1A1000", border: "none",
          borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: FONT }}>
        Confirmer
      </button>
    </div>
  );
}

/* ── Compteur animé ──────────────────────────────────────────────────────────── */
function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function StatsBand() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const restos   = useCountUp(200,  1600, visible);
  const resaCount= useCountUp(15000,1800, visible);
  const cities   = useCountUp(12,   1200, visible);
  const rating   = useCountUp(48,   1400, visible); // affiché comme 4.8

  const stats = [
    { value: `${restos}+`,          label: "Restaurants partenaires", icon: UtensilsCrossed, color: P },
    { value: `${resaCount.toLocaleString("fr-FR")}+`, label: "Réservations effectuées", icon: Calendar, color: S },
    { value: `${cities}`,           label: "Villes couvertes",        icon: MapPin,          color: DARK },
    { value: `${(rating / 10).toFixed(1)}/5`, label: "Note moyenne clients", icon: Star,    color: P },
  ];

  return (
    <div ref={ref} style={{ background: DARK, padding: "28px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px",
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
        {stats.map((s, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 10 }} animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            style={{ textAlign: "center", padding: "8px 0",
              borderRight: i < 3 ? "0.5px solid rgba(255,255,255,0.1)" : "none" }}>
            <s.icon size={18} color={s.color} style={{ marginBottom: 8, opacity: 0.9 }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: WHITE,
              letterSpacing: "-1px", lineHeight: 1, marginBottom: 4, fontFamily: FONT }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.5px", fontFamily: FONT }}>
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────────── */
function Footer({ scrollTo, listRef, experiencesRef, howRef }) {
  return (
    <footer style={{ background: DARK, borderTop: "0.5px solid rgba(255,255,255,0.08)", fontFamily: FONT }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 32, marginBottom: 32 }}>

          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
              <Logo size={24} />
              <span style={{ fontSize: 15, fontWeight: 600, color: WHITE, letterSpacing: "-0.3px" }}>
                Tablière<span style={{ color: P }}>CI</span>
              </span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 260, margin: 0 }}>
              La plateforme de réservation de restaurants en Côte d'Ivoire. Simple, rapide, gratuit pour les clients.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {[
                { label: "Sécurisé", icon: Shield },
                { label: "Mobile", icon: Smartphone },
                { label: "Temps réel", icon: TrendingUp },
              ].map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4,
                  background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "4px 8px" }}>
                  <b.icon size={10} color={P} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Plateforme */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14 }}>
              Plateforme
            </div>
            {[
              { label: "Restaurants", action: () => scrollTo(listRef) },
              { label: "Expériences", action: () => scrollTo(experiencesRef) },
              { label: "Comment ça marche", action: () => scrollTo(howRef) },
            ].map((l, i) => (
              <button key={i} onClick={l.action}
                style={{ display: "block", background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 10, padding: 0,
                  textAlign: "left", fontFamily: FONT,
                  transition: "color .15s" }}
                onMouseEnter={e => e.target.style.color = WHITE}
                onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.5)"}>
                {l.label}
              </button>
            ))}
          </div>

          {/* Restaurateurs */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14 }}>
              Restaurateurs
            </div>
            {[
              { label: "Créer un compte",     href: "/inscription?role=restaurateur" },
              { label: "Gérer mon restaurant", href: "/connexion?role=restaurateur" },
            ].map((l, i) => (
              <a key={i} href={l.href}
                style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.5)",
                  marginBottom: 10, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={e => e.target.style.color = WHITE}
                onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.5)"}>
                {l.label}
              </a>
            ))}
          </div>

          {/* Contact */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14 }}>
              Contact
            </div>
            {[
              "contact@tabliereci.net",
              "+225 07 00 00 00 00",
              "Abidjan, Côte d'Ivoire",
            ].map((l, i) => (
              <div key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>{l}</div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", paddingTop: 18,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            © 2026 TablièreCI. Tous droits réservés.
          </span>
          <div style={{ display: "flex", gap: 20 }}>
            {[
              { label: "Confidentialité",  href: "/confidentialite" },
              { label: "CGU",              href: "/cgu" },
            ].map(({ label, href }, i) => (
              <a key={i} href={href}
                style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", cursor: "pointer",
                  textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.7)"}
                onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.35)"}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Stars ───────────────────────────────────────────────────────────────────── */
function Stars({ rating }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11}
          fill={i <= Math.round(rating || 0) ? P : "none"}
          color={i <= Math.round(rating || 0) ? P : BORDER} />
      ))}
    </div>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  usePageMeta(null, "Réservez les meilleures tables d'Abidjan et de Côte d'Ivoire — confirmation immédiate, annulation gratuite.");
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  // Cloisonnement des rôles : un restaurateur ou un admin n'a pas sa place sur
  // l'accueil client → on le renvoie immédiatement vers son espace dédié.
  useEffect(() => {
    if (user?.role === "restaurateur") navigate("/restaurant", { replace: true });
    else if (user?.role === "admin")   navigate("/admin", { replace: true });
    else if (user?.role === "organisateur") navigate("/event", { replace: true });
  }, [user, navigate]);

  // Keep-alive : ping léger du backend pour éviter la mise en veille (cold start
  // Render) pendant que l'utilisateur navigue. Non authentifié → simple fetch.
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";
    const origin  = apiBase.replace(/\/api\/v1\/?$/, "");
    const ping = () => { fetch(origin + "/ping").catch(() => {}); };
    ping();
    const id = setInterval(ping, 4 * 60 * 1000); // toutes les 4 min
    return () => clearInterval(id);
  }, []);

  const { lang, t, changeLang, langs } = useLang();
  const listRef        = useRef(null);
  const experiencesRef = useRef(null);
  const howRef         = useRef(null);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const [restaurants, setRestaurants] = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(1);
  const [loadError,   setLoadError]   = useState(false);
  const [view,        setView]        = useState("list"); // "list" | "map"
  const [search,      setSearch]      = useState("");
  const [activeTab,   setActiveTab]   = useState(0);
  const [sort,        setSort]        = useState("rating");
  const [checkedC,    setCheckedC]    = useState({});
  const [favorites,   setFavorites]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("tci_favorites") || "[]"); } catch { return []; }
  });
  const [showUserMenu,   setShowUserMenu]   = useState(false);
  const [showLang,       setShowLang]       = useState(false);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const [notifs,         setNotifs]         = useState([]);
  const [notifsLoading,  setNotifsLoading]  = useState(false);

  // Filtres barre
  const todayStr = new Date().toISOString().split("T")[0];
  const [resaDate,   setResaDate]   = useState(todayStr);
  const [resaTime,   setResaTime]   = useState("19:00");
  const [resaGuests, setResaGuests] = useState(2);
  const [openFilter, setOpenFilter] = useState(null); // "date" | "time" | "guests" | null
  const [locating,   setLocating]   = useState(false);
  const [locCity,    setLocCity]    = useState("");

  const toggleFilter = (name) => setOpenFilter(f => f === name ? null : name);

  const handleGeolocate = () => {
    if (!navigator.geolocation) { alert("Géolocalisation non supportée"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Détection simple basée sur les coordonnées CI
        const city = latitude >= 4.8 && latitude <= 6.2 && longitude >= -5.5 && longitude <= -3.5
          ? "Abidjan" : latitude >= 6.5 ? "Bouaké" : latitude >= 7.3 ? "Korhogo" : "Abidjan";
        setLocCity(city);
        setSearch(city);
        setLocating(false);
        scrollTo(listRef);
      },
      () => { setLocating(false); alert("Impossible de détecter votre position"); },
      { timeout: 8000 }
    );
  };

  const TABS = [
    { key: "tab_all",       params: {} },
    { key: "tab_gastro",    params: { cuisine_type: "Gastronomique" } },
    { key: "tab_ivoirian",  params: { cuisine_type: "Ivoirienne" } },
    { key: "tab_brunch",    params: { search: "brunch" } },
    { key: "tab_terrace",   params: { search: "terrasse" } },
    { key: "tab_livemusic", params: { search: "jazz" } },
  ];

  const CUISINES = [
    { key: "cuisine_ivoirian",      val: "Ivoirienne" },
    { key: "cuisine_french",        val: "Française" },
    { key: "cuisine_lebanese",      val: "Libanaise" },
    { key: "cuisine_senegalese",    val: "Sénégalaise" },
    { key: "cuisine_international", val: "Internationale" },
  ];
  const SPECS = [
    { key: "spec_terrace",      val: "Terrasse" },
    { key: "spec_livemusic",    val: "Live music" },
    { key: "spec_halal",        val: "Halal" },
    { key: "spec_privatizable", val: "Privatisable" },
    { key: "spec_wifi",         val: "Wifi" },
  ];

  const EXPERIENCES = [
    { icon: Music,           bg: "#FEF6EC", nameKey: "exp_jazz_name",   subKey: "exp_jazz_sub"   },
    { icon: Sunrise,         bg: "#F0F6F2", nameKey: "exp_brunch_name", subKey: "exp_brunch_sub" },
    { icon: Gift,            bg: "#F0F4EC", nameKey: "exp_event_name",  subKey: "exp_event_sub"  },
    { icon: UtensilsCrossed, bg: "#FEF6EC", nameKey: "exp_feast_name",  subKey: "exp_feast_sub"  },
  ];

  const HOW_STEPS = [
    { icon: Search,   titleKey: "how_1_title", descKey: "how_1_desc", num: "01" },
    { icon: BookOpen, titleKey: "how_2_title", descKey: "how_2_desc", num: "02" },
    { icon: Sparkles, titleKey: "how_3_title", descKey: "how_3_desc", num: "03" },
  ];

  // Fermer menus + dropdowns au clic dehors
  useEffect(() => {
    const close = () => { setShowUserMenu(false); setShowLang(false); setOpenFilter(null); setShowNotifs(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const PAGE_SIZE = 24;
  const buildParams = useCallback(() => {
    const params = { ...TABS[activeTab].params, limit: PAGE_SIZE };
    if (search) params.search = search;
    if (sort !== "rating") params.sort = sort;
    const ck = Object.entries(checkedC).filter(([,v]) => v).map(([k]) => k);
    if (ck.length === 1) params.cuisine_type = ck[0];
    // Le sélecteur "personnes" filtre les restaurants pouvant accueillir la table
    if (resaGuests > 1) params.min_capacity = resaGuests;
    return params;
  }, [search, sort, checkedC, activeTab, resaGuests]);

  // Charge une page ; append=true ajoute à la suite (« Charger plus »)
  const loadPage = useCallback((pageArg, append) => {
    (append ? setLoadingMore : setLoading)(true);
    if (!append) setLoadError(false);
    restaurantsService.list({ ...buildParams(), page: pageArg })
      .then(res => {
        const rows = res.data || [];
        setRestaurants(prev => append ? [...prev, ...rows] : rows);
        setTotal(res.pagination?.total || 0);
        setPage(pageArg);
      })
      .catch(() => { if (!append) { setRestaurants([]); setLoadError(true); } })
      .finally(() => (append ? setLoadingMore : setLoading)(false));
  }, [buildParams]);

  const loadRestaurants = useCallback(() => loadPage(1, false), [loadPage]);
  // Reset à la page 1 quand un filtre/onglet/recherche change
  useEffect(() => { loadPage(1, false); }, [buildParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ouvre une fiche restaurant en transmettant le contexte de réservation
  // (date/heure/couverts) pour pré-remplir le formulaire de réservation.
  const openRestaurant = (slug) => {
    const qs = new URLSearchParams({
      date: resaDate || "", time: resaTime || "", guests: String(resaGuests || 2),
    }).toString();
    navigate(`/restaurants/${slug}?${qs}`);
  };

  // Ouvre la fiche resto ET pré-ouvre la réservation sur le créneau choisi
  const openRestaurantAtSlot = (slug, slot) => {
    const qs = new URLSearchParams({
      date: resaDate || "", guests: String(resaGuests || 2), slot,
    }).toString();
    navigate(`/restaurants/${slug}?${qs}`);
  };

  const toggle = (setter, key) => setter(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleFavorite = (e, r) => {
    e.stopPropagation();
    const exists = favorites.some(f => f.slug === r.slug);
    const updated = exists
      ? favorites.filter(f => f.slug !== r.slug)
      : [...favorites, { slug: r.slug, name: r.name, ville: r.ville, cuisine_type: r.cuisine_type, restaurant_id: r.id }];
    setFavorites(updated);
    localStorage.setItem("tci_favorites", JSON.stringify(updated));
    // Si connecté : synchroniser côté serveur (favoris retrouvés sur tout appareil)
    if (user) {
      if (exists) usersService.removeFavorite(r.id).catch(() => {});
      else        usersService.addFavorite({ slug: r.slug }).catch(() => {});
    }
  };

  // Charger les favoris du compte à la connexion (fusion avec le local)
  useEffect(() => {
    if (!user) return;
    usersService.listFavorites()
      .then(rows => {
        if (!Array.isArray(rows)) return;
        const mapped = rows.map(f => ({
          slug: f.slug, name: f.name, ville: f.ville,
          cuisine_type: f.cuisine_type, restaurant_id: f.restaurant_id,
        }));
        setFavorites(mapped);
        try { localStorage.setItem("tci_favorites", JSON.stringify(mapped)); } catch {}
      })
      .catch(() => {}); // en cas d'échec on garde le local
  }, [user]);

  const isFav   = (slug) => favorites.some(f => f.slug === slug);
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const resultsText = loading
    ? t("loading")
    : total === 0
      ? t("results_count_0")
      : t("results_count").replace("{n}", total).replace(/{s}/g, total !== 1 ? "s" : "");

  const isRTL = lang === "ar";

  // Format date affichage
  const displayDate = resaDate
    ? (() => {
        const d = new Date(resaDate + "T00:00:00");
        return `${d.getDate()} ${MONTHS_FR[d.getMonth()].slice(0,3)}.`;
      })()
    : "Date";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Version mobile dédiée (style OpenTable) ────────────────────────────────
  if (isMobile) return <HomeMobile />;

  return (
    <div style={{ fontFamily: FONT, background: BG, minHeight: "100vh",
      direction: isRTL ? "rtl" : "ltr" }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "12px 16px" : "14px 32px", background: WHITE,
        borderBottom: `0.5px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 30, gap: 12 }}>

        <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flexShrink: 0 }}>
          <Logo size={28} />
          <span style={{ fontSize: 16, fontWeight: 600, color: DARK, letterSpacing: "-0.3px" }}>
            Tablière<span style={{ color: P }}>CI</span>
          </span>
        </div>

        {/* Liens nav — cachés sur mobile */}
        {!isMobile && (
          <div style={{ display: "flex", gap: 28, fontSize: 13, color: MUTED }}>
            {[
              { key: "nav_restaurants", action: () => scrollTo(listRef) },
              { key: "nav_experiences", action: () => scrollTo(experiencesRef) },
              { key: "nav_how",         action: () => scrollTo(howRef) },
              { key: "nav_events", label: "Événements", action: () => navigate("/evenements") },
            ].map(({ key, label, action }) => (
              <span key={key} onClick={action}
                style={{ cursor: "pointer", whiteSpace: "nowrap",
                  transition: "color .15s", fontWeight: 500 }}
                onMouseEnter={e => e.target.style.color = DARK}
                onMouseLeave={e => e.target.style.color = MUTED}>
                {label || t(key)}
              </span>
            ))}
          </div>
        )}

        {/* Mobile — boutons directs */}
        {isMobile ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/connexion")}
              style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "7px 12px",
                fontSize: 13, background: "transparent", cursor: "pointer",
                color: DARK, fontWeight: 500, fontFamily: FONT }}>
              Connexion
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/inscription")}
              style={{ border: "none", borderRadius: 8, padding: "8px 14px",
                fontSize: 13, background: P, color: "#1A1000",
                cursor: "pointer", fontWeight: 700, fontFamily: FONT }}>
              + S'inscrire
            </motion.button>
          </div>
        ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Langue */}
          <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
            <button onClick={() => { setShowLang(p => !p); setShowUserMenu(false); }}
              style={{ display: "flex", alignItems: "center", gap: 5,
                border: `0.5px solid ${BORDER}`, borderRadius: 8,
                padding: "6px 10px", background: WHITE, cursor: "pointer",
                fontSize: 12, color: MUTED, fontFamily: FONT }}>
              <Globe size={13} color={P} />
              {LANG_SHORT[lang]}
            </button>
            <AnimatePresence>
              {showLang && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{ position: "absolute", top: "calc(100% + 6px)",
                    [isRTL ? "left" : "right"]: 0, background: WHITE,
                    border: `0.5px solid ${BORDER}`, borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,.08)",
                    overflow: "hidden", minWidth: 140, zIndex: 100 }}>
                  {langs.map(l => (
                    <button key={l} onClick={() => { changeLang(l); setShowLang(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "9px 14px", border: "none",
                        background: l === lang ? "#FEF6EC" : WHITE,
                        cursor: "pointer", fontSize: 13, fontFamily: FONT,
                        color: l === lang ? P : "#444", fontWeight: l === lang ? 600 : 400 }}>
                      {LANG_SHORT[l]} · {LANG_LABELS[l]}
                      {l === lang && <CheckCircle size={12} color={P} style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cloche notifications — client connecté */}
          {user && (
            <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
              <button
                onClick={async () => {
                  const next = !showNotifs;
                  setShowNotifs(next);
                  setShowUserMenu(false);
                  setShowLang(false);
                  if (next && notifs.length === 0) {
                    setNotifsLoading(true);
                    try {
                      const { data } = await api.get("/notifications");
                      setNotifs(data.data?.notifications || data.data || []);
                    } catch(_) {}
                    setNotifsLoading(false);
                  }
                }}
                style={{ position: "relative", border: `0.5px solid ${BORDER}`, borderRadius: 8,
                  padding: "6px 10px", background: WHITE, cursor: "pointer", display: "flex",
                  alignItems: "center" }}>
                <Bell size={15} color={MUTED} />
                {notifs.filter(n => !n.is_read).length > 0 && (
                  <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8,
                    borderRadius: "50%", background: "#DC2626", border: "1.5px solid white" }} />
                )}
              </button>
              <AnimatePresence>
                {showNotifs && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                    style={{ position: "absolute", top: "calc(100% + 8px)", right: 0,
                      width: 320, background: WHITE, border: `0.5px solid ${BORDER}`,
                      borderRadius: 12, boxShadow: "0 8px 32px rgba(30,46,40,.13)",
                      zIndex: 200, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", borderBottom: `0.5px solid ${BORDER}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: DARK }}>Notifications</span>
                      {notifs.filter(n => !n.is_read).length > 0 && (
                        <button onClick={async () => {
                          try { await api.patch("/notifications/read-all"); setNotifs(p => p.map(n => ({ ...n, is_read: true }))); } catch(_) {}
                        }} style={{ fontSize: 11, color: P, background: "none", border: "none",
                          cursor: "pointer", fontFamily: FONT }}>
                          Tout lire
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: 320, overflowY: "auto" }}>
                      {notifsLoading ? (
                        <div style={{ padding: 24, textAlign: "center", color: MUTED, fontSize: 13 }}>
                          Chargement…
                        </div>
                      ) : notifs.length === 0 ? (
                        <div style={{ padding: 24, textAlign: "center", color: MUTED, fontSize: 13 }}>
                          Aucune notification
                        </div>
                      ) : notifs.map(n => (
                        <div key={n.id}
                          style={{ padding: "10px 16px", borderBottom: `0.5px solid ${BORDER}`,
                            background: n.is_read ? "transparent" : "#FEF6EC",
                            cursor: "pointer" }}
                          onClick={async () => {
                            if (!n.is_read) {
                              try { await api.patch(`/notifications/${n.id}/read`); setNotifs(p => p.map(x => x.id === n.id ? { ...x, is_read: true } : x)); } catch(_) {}
                            }
                          }}>
                          <div style={{ fontSize: 12, color: DARK, fontWeight: n.is_read ? 400 : 600 }}>
                            {n.title || n.message}
                          </div>
                          {n.body && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{n.body}</div>}
                          <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
                            {new Date(n.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "8px 16px", borderTop: `0.5px solid ${BORDER}`, textAlign: "center" }}>
                      <button onClick={() => { setShowNotifs(false); navigate("/profil?tab=notifications"); }}
                        style={{ fontSize: 12, color: P, background: "none", border: "none",
                          cursor: "pointer", fontFamily: FONT }}>
                        Voir toutes les notifications →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {user ? (
            <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => { setShowUserMenu(p => !p); setShowLang(false); }}
                style={{ display: "flex", alignItems: "center", gap: 6,
                  border: `0.5px solid ${BORDER}`, borderRadius: 20,
                  padding: "5px 10px 5px 5px", background: WHITE, cursor: "pointer", fontFamily: FONT }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: P,
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <User size={13} color="white" />}
                </div>
                <span style={{ fontSize: 13, color: DARK, maxWidth: 100,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.full_name?.split(" ")[0]}
                </span>
                <ChevronDown size={12} color={MUTED} />
              </button>
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    style={{ position: "absolute", top: "calc(100% + 6px)",
                      [isRTL ? "left" : "right"]: 0, background: WHITE,
                      border: `0.5px solid ${BORDER}`, borderRadius: 10,
                      boxShadow: "0 4px 20px rgba(0,0,0,.08)",
                      overflow: "hidden", minWidth: 180, zIndex: 100 }}>
                    <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${BG}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{user.full_name}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{user.email}</div>
                    </div>
                    <button onClick={() => navigate("/profil")} style={menuBtn}>
                      <User size={14} color={P} /> {t("nav_profile")}
                    </button>
                    <button onClick={() => navigate("/profil?tab=reservations")} style={menuBtn}>
                      <Star size={14} color={P} /> {t("nav_reservations")}
                    </button>
                    <button onClick={() => logout()}
                      style={{ ...menuBtn, color: "#DC2626", borderTop: `0.5px solid ${BG}` }}>
                      <LogOut size={14} /> {t("nav_logout")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/connexion")}
                style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "7px 16px",
                  fontSize: 13, background: "transparent", cursor: "pointer",
                  color: DARK, fontWeight: 500, fontFamily: FONT }}>
                {t("nav_login")}
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate("/inscription")}
                style={{ border: "none", borderRadius: 8, padding: "8px 18px",
                  fontSize: 13, background: P, color: "#1A1000",
                  cursor: "pointer", fontWeight: 700, fontFamily: FONT }}>
                {t("nav_register")}
              </motion.button>
            </>
          )}
        </div>
        )}
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ background: WHITE, borderBottom: `0.5px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 420px",
          alignItems: "center", gap: 0, minHeight: isMobile ? "auto" : 340 }}>

          {/* Texte gauche */}
          <div style={{ padding: isMobile ? "28px 16px 24px" : "52px 32px 52px 40px" }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 7,
                background: "#FEF6EC", border: `0.5px solid #F0C98A`,
                borderRadius: 20, padding: "4px 14px", marginBottom: 22 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: S }} />
              <span style={{ fontSize: 11, color: "#C47D1A", letterSpacing: "0.3px",
                fontWeight: 600 }}>{t("hero_live")}</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{ fontSize: "clamp(28px, 3.5vw, 42px)", fontWeight: 300, color: DARK,
                lineHeight: 1.1, marginBottom: 16, letterSpacing: "-1px", maxWidth: 520 }}>
              {t("hero_title_1")}<br />
              <span style={{ fontStyle: "italic", color: P }}>{t("hero_title_2")}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              style={{ color: MUTED, fontSize: 14, marginBottom: 32,
                lineHeight: 1.75, maxWidth: 420, fontWeight: 400 }}>
              {t("hero_sub")}
            </motion.p>

            {/* ── Barre de recherche — simplifiée sur mobile ── */}
            {isMobile ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ display: "flex", background: WHITE, borderRadius: 12,
                  border: `0.5px solid ${BORDER}`, overflow: "hidden",
                  boxShadow: "0 2px 16px rgba(30,46,40,.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", flex: 1 }}>
                  <Search size={15} color={MUTED} />
                  <input placeholder="Restaurant, cuisine, quartier…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && scrollTo(listRef)}
                    style={{ border: "none", background: "transparent", fontSize: 14,
                      color: DARK, outline: "none", width: "100%", padding: "14px 0", fontFamily: FONT }} />
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => scrollTo(listRef)}
                  style={{ background: P, color: "#1A1000", border: "none",
                    padding: "0 20px", cursor: "pointer", fontSize: 14,
                    fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>
                  {t("search_btn")}
                </motion.button>
              </motion.div>
            ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ display: "flex", background: WHITE, borderRadius: 14,
                border: `1px solid ${BORDER}`, overflow: "visible",
                maxWidth: 780, boxShadow: "0 4px 32px rgba(30,46,40,.12)" }}>

              {/* Date */}
              <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
                <button onClick={() => toggleFilter("date")}
                  style={filterCell}>
                  <Calendar size={14} color={P} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={filterLbl}>Date</div>
                    <div style={filterVal}>{displayDate}</div>
                  </div>
                  <ChevronDown size={12} color={MUTED} />
                </button>
                {openFilter === "date" && (
                  <CalendarDropdown value={resaDate} onChange={setResaDate}
                    onClose={() => setOpenFilter(null)} />
                )}
              </div>

              <div style={sep} />

              {/* Heure */}
              <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
                <button onClick={() => toggleFilter("time")}
                  style={filterCell}>
                  <Clock size={14} color={P} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={filterLbl}>Heure</div>
                    <div style={filterVal}>{resaTime}</div>
                  </div>
                  <ChevronDown size={12} color={MUTED} />
                </button>
                {openFilter === "time" && (
                  <TimeDropdown value={resaTime} onChange={setResaTime}
                    onClose={() => setOpenFilter(null)} />
                )}
              </div>

              <div style={sep} />

              {/* Personnes */}
              <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
                <button onClick={() => toggleFilter("guests")}
                  style={filterCell}>
                  <Users size={14} color={P} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={filterLbl}>Personnes</div>
                    <div style={filterVal}>{resaGuests} {resaGuests === 1 ? "personne" : "pers."}</div>
                  </div>
                  <ChevronDown size={12} color={MUTED} />
                </button>
                {openFilter === "guests" && (
                  <GuestsDropdown value={resaGuests} onChange={setResaGuests}
                    onClose={() => setOpenFilter(null)} />
                )}
              </div>

              <div style={sep} />

              {/* Recherche texte */}
              <div style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "0 16px", flex: 1 }}>
                <Search size={14} color={MUTED} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={filterLbl}>Recherche</div>
                  <input placeholder="Restaurant, cuisine, quartier…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && scrollTo(listRef)}
                    style={{ border: "none", background: "transparent",
                      fontSize: 13, color: DARK, outline: "none",
                      width: "100%", padding: 0, fontFamily: FONT }} />
                </div>
              </div>

              {/* CTA */}
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => scrollTo(listRef)}
                style={{ background: P, color: "#1A1000", border: "none",
                  borderRadius: "0 11px 11px 0", padding: "0 28px",
                  cursor: "pointer", fontSize: 14, fontWeight: 700,
                  flexShrink: 0, fontFamily: FONT, letterSpacing: "0.2px" }}>
                {t("search_btn")}
              </motion.button>
            </motion.div>
            )}

            {/* Géolocalisation */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              style={{ marginTop: 14 }}>
              <button onClick={handleGeolocate} disabled={locating}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
                  border: "none", cursor: locating ? "default" : "pointer",
                  fontSize: 12, color: MUTED, fontFamily: FONT, padding: 0 }}>
                <MapPin size={13} color={locating ? BORDER : S} />
                {locating ? "Localisation en cours…"
                  : locCity ? `Position détectée : ${locCity}`
                  : "Utiliser ma position (facultatif)"}
              </button>
            </motion.div>
          </div>

          {/* Décor droite — caché sur mobile */}
          {!isMobile && <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{ padding: "24px 24px 24px 0", alignSelf: "stretch",
              display: "flex", alignItems: "center" }}>
            <HeroDecor />
          </motion.div>}
        </div>
      </div>

      {/* ── Stats band ────────────────────────────────────────────────────── */}
      <StatsBand />

      {/* ── Bande déco ────────────────────────────────────────────────────── */}
      <div style={{ height: 3,
        background: `linear-gradient(90deg,${P} 0%,${S} 50%,${P} 100%)`, opacity: 0.22 }} />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div ref={listRef} style={{ display: "flex", padding: "0 32px", background: WHITE,
        borderBottom: `0.5px solid ${BORDER}`, overflowX: "auto" }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: "13px 18px", fontSize: 13, cursor: "pointer",
              background: "transparent", border: "none", whiteSpace: "nowrap",
              color: activeTab === i ? P : MUTED,
              borderBottom: `2px solid ${activeTab === i ? P : "transparent"}`,
              fontWeight: activeTab === i ? 600 : 400, fontFamily: FONT,
              transition: "all .15s" }}>
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px",
          textTransform: "uppercase", color: MUTED, padding: "18px 0 8px" }}>
          {t("results_label")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "clamp(160px,22%,230px) 1fr", gap: 20 }}>

          {/* Filtres */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ background: WHITE, border: `0.5px solid ${BORDER}`,
              borderRadius: 12, padding: 16 }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>
                  {t("filter_cuisine")}
                </div>
                {CUISINES.map(({ key, val }) => (
                  <label key={val} style={{ display: "flex", alignItems: "center",
                    gap: 8, padding: "5px 0", fontSize: 13, color: DARK,
                    cursor: "pointer", fontFamily: FONT }}>
                    <input type="checkbox" checked={!!checkedC[val]}
                      onChange={() => toggle(setCheckedC, val)}
                      style={{ accentColor: P }} />
                    {t(key)}
                  </label>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>
                  {t("filter_specs")}
                </div>
                {SPECS.map(({ key, val }) => (
                  <label key={val} style={{ display: "flex", alignItems: "center",
                    gap: 8, padding: "5px 0", fontSize: 13, color: DARK,
                    cursor: "pointer", fontFamily: FONT }}>
                    <input type="checkbox" style={{ accentColor: P }} />
                    {t(key)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Résultats */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>{resultsText}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Bascule Liste / Carte */}
                <div style={{ display: "inline-flex", background: "#EFEAE2", borderRadius: 9, padding: 3 }}>
                  {[["list", "Liste"], ["map", "Carte"]].map(([v, label]) => (
                    <button key={v} onClick={() => setView(v)}
                      style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 13px",
                        fontSize: 12, fontWeight: 700, fontFamily: FONT,
                        background: view === v ? WHITE : "transparent", color: view === v ? DARK : MUTED,
                        boxShadow: view === v ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                        display: "flex", alignItems: "center", gap: 5 }}>
                      {v === "map" && <MapPin size={12} />}{label}
                    </button>
                  ))}
                </div>
                <select value={sort} onChange={e => setSort(e.target.value)}
                  style={{ fontSize: 12, border: `0.5px solid ${BORDER}`, borderRadius: 8,
                    padding: "5px 10px", background: WHITE, color: DARK,
                    cursor: "pointer", fontFamily: FONT }}>
                  <option value="rating">{t("sort_rating")}</option>
                  <option value="reviews">{t("sort_reviews")}</option>
                  <option value="recent">{t("sort_recent")}</option>
                </select>
              </div>
            </div>

            {view === "map" && !loading && !loadError ? (
              <div style={{ height: "60vh", minHeight: 380 }}>
                <Suspense fallback={
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: BG, borderRadius: 12, color: MUTED, fontSize: 13 }}>Chargement de la carte…</div>
                }>
                  <MapView restaurants={restaurants} onSelect={(r) => openRestaurant(r.slug)} />
                </Suspense>
              </div>
            ) : loading ? (
              <div>
                {[0,1,2,3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : loadError ? (
              <div style={{ textAlign: "center", padding: "52px 20px", fontFamily: FONT }}>
                <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#FEF2F2",
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <WifiOff size={30} color="#DC2626" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>Connexion interrompue</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 300, marginInline: "auto", lineHeight: 1.5 }}>
                  Impossible de charger les restaurants pour le moment. Vérifiez votre connexion et réessayez.
                </div>
                <motion.button whileTap={{ scale: 0.96 }} onClick={loadRestaurants}
                  style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 7,
                    background: DARK, color: "white", border: "none", borderRadius: 10,
                    padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  <RefreshCw size={15} /> Réessayer
                </motion.button>
              </div>
            ) : restaurants.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px", fontFamily: FONT }}>
                <div style={{ width: 68, height: 68, borderRadius: "50%", background: BG,
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Search size={28} color={MUTED} style={{ opacity: 0.7 }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>
                  {t("no_resto_title")}
                </div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 300, marginInline: "auto", lineHeight: 1.5 }}>
                  {search ? t("no_resto_search") : t("no_resto_empty")}
                </div>
                {(search || Object.values(checkedC).some(Boolean)) && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { setSearch(""); setCheckedC({}); }}
                    style={{ marginTop: 18, background: "#FEF6EC", color: "#C47D1A",
                      border: `0.5px solid ${P}55`, borderRadius: 10, padding: "9px 20px",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    Réinitialiser la recherche
                  </motion.button>
                )}
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show"
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {restaurants.map((r) => {
                  const photos = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos : null;
                  const imgSrc = photos ? photos[0] : r.logo_url;
                  const b = cardBadge(r);
                  const saved = isFav(r.slug);
                  const slots = dynamicSlots(resaTime);
                  return (
                  <motion.div key={r.id} variants={fadeUp}
                    whileHover={{ y: -3, boxShadow: "0 8px 26px rgba(30,46,40,.10)" }}
                    onClick={() => openRestaurant(r.slug)}
                    style={{ background: WHITE, borderRadius: 16, border: `0.5px solid ${BORDER}`,
                      overflow: "hidden", cursor: "pointer", transition: "box-shadow .2s",
                      boxShadow: "0 2px 12px rgba(30,46,40,.05)", fontFamily: FONT }}>

                    {/* Photo plein cadre + dégradé + infos en surimpression */}
                    <div style={{ position: "relative", width: "100%", height: 178, background: BG,
                      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {imgSrc ? (
                        <img src={imgSrc} alt={r.name}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                          onError={e => { e.target.style.display = "none"; }} />
                      ) : (
                        <UtensilsCrossed size={42} color={P} style={{ opacity: 0.35 }} />
                      )}
                      <div style={{ position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(20,28,24,.82) 0%, rgba(20,28,24,.25) 42%, rgba(20,28,24,0) 66%)" }} />
                      {b && (
                        <span style={{ position: "absolute", top: 10, left: 10, fontSize: 10, fontWeight: 700,
                          color: "white", background: b.bg, padding: "4px 10px", borderRadius: 20,
                          letterSpacing: "0.4px" }}>{b.label}</span>
                      )}
                      <button onClick={e => toggleFavorite(e, r)}
                        title={saved ? "Retirer des enregistrés" : "Enregistrer"}
                        style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.92)",
                          border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Bookmark size={15} fill={saved ? P : "none"} color={saved ? P : MUTED} />
                      </button>
                      <div style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
                        {r.cuisine_type && (
                          <div style={{ fontSize: 9.5, letterSpacing: "1.5px", textTransform: "uppercase",
                            color: "rgba(255,255,255,.85)", fontWeight: 700, marginBottom: 4 }}>{r.cuisine_type}</div>
                        )}
                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 19, fontWeight: 700, color: "white", letterSpacing: "-0.3px",
                            textShadow: "0 1px 8px rgba(0,0,0,.3)" }}>{r.name}</div>
                          {r.rating > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(255,255,255,.95)",
                              borderRadius: 8, padding: "2px 7px", flexShrink: 0 }}>
                              <Star size={11} fill={P} color={P} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: DARK }}>{Number(r.rating).toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Infos + créneaux */}
                    <div style={{ padding: "11px 14px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 11 }}>
                        {r.quartier && <span style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 3 }}><MapPin size={11} />{r.quartier}</span>}
                        {r.price_range && <><span style={{ fontSize: 11, color: BORDER }}>·</span><span style={{ fontSize: 12, color: MUTED }}>{r.price_range}</span></>}
                        {r.rating > 0 && <><span style={{ fontSize: 11, color: BORDER }}>·</span><span style={{ fontSize: 12, color: MUTED }}>{r.review_count || 0} avis</span></>}
                      </div>
                      {slots.length === 0 ? (
                        <motion.button whileTap={{ scale: 0.96 }}
                          onClick={e => { e.stopPropagation(); openRestaurant(r.slug); }}
                          style={{ width: "100%", fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 10,
                            border: `0.5px solid ${P}55`, background: "#FEF6EC", color: "#C47D1A",
                            cursor: "pointer", fontFamily: FONT }}>
                          {t("see_slots")}
                        </motion.button>
                      ) : (
                        <div style={{ display: "flex", gap: 7 }}>
                          {slots.slice(0, 4).map(s => (
                            <motion.button key={s} whileTap={{ scale: 0.94 }}
                              onClick={e => { e.stopPropagation(); openRestaurantAtSlot(r.slug, s); }}
                              style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: "9px 4px", borderRadius: 9,
                                border: "none", background: P, color: "white",
                                cursor: "pointer", fontFamily: FONT }}>
                              {s}
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Charger plus (pagination progressive) */}
            {!loading && restaurants.length > 0 && restaurants.length < total && (
              <div style={{ textAlign: "center", marginTop: 22 }}>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => loadPage(page + 1, true)} disabled={loadingMore}
                  style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 26px",
                    background: "white", color: DARK, fontSize: 13.5, fontWeight: 600,
                    cursor: loadingMore ? "default" : "pointer", fontFamily: FONT }}>
                  {loadingMore ? "Chargement…" : `Charger plus (${restaurants.length}/${total})`}
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* ── Expériences ─────────────────────────────────────────────────── */}
        <div ref={experiencesRef}
          style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 28, marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: DARK,
            marginBottom: 16, fontFamily: FONT }}>{t("exp_title")}</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {EXPERIENCES.map((e, i) => (
              <motion.div key={i} whileHover={{ y: -3, boxShadow: "0 4px 16px rgba(30,46,40,.07)" }}
                style={{ minWidth: 180, border: `0.5px solid ${BORDER}`, borderRadius: 12,
                  overflow: "hidden", background: WHITE, cursor: "pointer", flexShrink: 0 }}>
                <div style={{ height: 84, background: e.bg,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <e.icon size={32} color={P} style={{ opacity: 0.8 }} />
                </div>
                <div style={{ padding: "10px 14px", fontFamily: FONT }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: DARK, marginBottom: 2 }}>
                    {t(e.nameKey)}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED }}>{t(e.subKey)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Comment ça marche ───────────────────────────────────────────── */}
        <div ref={howRef}
          style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 36, marginBottom: 56 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: DARK,
            marginBottom: 32, textAlign: "center", fontFamily: FONT }}>
            {t("how_title")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {HOW_STEPS.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: WHITE, border: `0.5px solid ${BORDER}`,
                  borderRadius: 14, padding: "24px 20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 10, right: 14, fontSize: 40,
                  fontWeight: 800, color: BG, lineHeight: 1, fontFamily: FONT }}>
                  {step.num}
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FEF6EC",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <step.icon size={19} color={P} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8,
                  color: DARK, fontFamily: FONT }}>
                  {t(step.titleKey)}
                </div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, fontFamily: FONT }}>
                  {t(step.descKey)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <Footer scrollTo={scrollTo} listRef={listRef} experiencesRef={experiencesRef} howRef={howRef} />
    </div>
  );
}

/* ── Styles partagés ─────────────────────────────────────────────────────────── */
const menuBtn = {
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  padding: "10px 14px", border: "none", background: "white",
  cursor: "pointer", fontSize: 13, color: "#333", fontFamily: FONT,
};

const filterCell = {
  display: "flex", alignItems: "center", gap: 8, padding: "18px 18px",
  background: "transparent", border: "none", cursor: "pointer",
  fontFamily: FONT, whiteSpace: "nowrap",
};

const filterLbl = {
  fontSize: 10, fontWeight: 700, color: MUTED,
  letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2,
};

const filterVal = {
  fontSize: 13, fontWeight: 600, color: DARK,
};

const sep = {
  width: "0.5px", background: BORDER, alignSelf: "stretch", margin: "10px 0",
};

const iconBtn = {
  width: 28, height: 28, borderRadius: "50%", border: `0.5px solid ${BORDER}`,
  background: WHITE, cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", color: DARK,
};
