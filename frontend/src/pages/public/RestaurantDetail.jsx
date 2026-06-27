import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, MapPin, Clock, Users, Calendar,
  UtensilsCrossed, CheckCircle, X, CalendarCheck, Phone,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { restaurantsService } from "../../services/restaurants.service.js";
import { reservationsService } from "../../services/reservations.service.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { usePageMeta } from "../../hooks/usePageMeta.js";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BG     = "#F8F5EF";
const BORDER = "#E4DFD8";
const MUTED  = "#9BA89F";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const LUNCH_SLOTS  = ["12h00","12h30","13h00","13h30","14h00"];
const DINNER_SLOTS = ["19h00","19h30","20h00","20h30","21h00","21h30","22h00"];
const ALL_SLOTS    = [...LUNCH_SLOTS, ...DINNER_SLOTS];

const PARTY_OPTIONS = [1,2,3,4,5,6,7,8,9,10,12];

const DAYS_FR = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const MONTHS_FR = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];

/** Génère les 14 prochains jours */
function buildDays() {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      dayName: DAYS_FR[d.getDay()],
      dayNum: d.getDate(),
      month: MONTHS_FR[d.getMonth()],
      isToday: i === 0,
    });
  }
  return days;
}

function toDatetime(isoDate, timeStr) {
  const match = timeStr.match(/^(\d+)h(\d*)$/);
  if (!match) return new Date().toISOString();
  const dt = new Date(isoDate + "T00:00:00");
  dt.setHours(parseInt(match[1]), parseInt(match[2] || "0"), 0, 0);
  return dt.toISOString();
}

function Stars({ rating }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14}
          fill={i <= Math.round(rating || 0) ? "#E8A045" : "none"}
          color={i <= Math.round(rating || 0) ? "#E8A045" : BORDER} />
      ))}
    </div>
  );
}

/** Sidebar / widget de réservation style OpenTable */
function BookingWidget({ onBook }) {
  const DAYS = buildDays();
  const [selDate, setSelDate] = useState(DAYS[0].iso);
  const [selSlot, setSelSlot] = useState(null);
  const [pers,    setPers]    = useState(2);
  const [carouselStart, setCarouselStart] = useState(0);
  const VISIBLE = 5;

  const visibleDays = DAYS.slice(carouselStart, carouselStart + VISIBLE);

  return (
    <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 14,
      padding: "22px 20px", boxShadow: "0 2px 16px rgba(30,46,40,.06)",
      position: "sticky", top: 70, fontFamily: FONT }}>

      <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 18 }}>
        Faire une réservation
      </div>

      {/* ── Carousel de dates ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.8px", marginBottom: 8 }}>Date</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => setCarouselStart(s => Math.max(0, s - 1))}
            disabled={carouselStart === 0}
            style={{ background: "transparent", border: "none", cursor: carouselStart === 0 ? "default" : "pointer",
              color: carouselStart === 0 ? BORDER : MUTED, padding: "0 2px", display: "flex" }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${VISIBLE}, 1fr)`, gap: 4 }}>
            {visibleDays.map(d => {
              const sel = selDate === d.iso;
              return (
                <button key={d.iso} onClick={() => { setSelDate(d.iso); setSelSlot(null); }}
                  style={{ padding: "7px 2px", borderRadius: 9, cursor: "pointer", textAlign: "center",
                    border: `0.5px solid ${sel ? P : BORDER}`,
                    background: sel ? PL : "white",
                    transition: "all .15s" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: sel ? P : MUTED,
                    textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {d.isToday ? "Auj." : d.dayName}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: sel ? P : DARK, lineHeight: 1.2 }}>
                    {d.dayNum}
                  </div>
                  <div style={{ fontSize: 9, color: sel ? P : MUTED }}>{d.month}</div>
                </button>
              );
            })}
          </div>
          <button onClick={() => setCarouselStart(s => Math.min(DAYS.length - VISIBLE, s + 1))}
            disabled={carouselStart + VISIBLE >= DAYS.length}
            style={{ background: "transparent", border: "none",
              cursor: carouselStart + VISIBLE >= DAYS.length ? "default" : "pointer",
              color: carouselStart + VISIBLE >= DAYS.length ? BORDER : MUTED, padding: "0 2px", display: "flex" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Nombre de personnes ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.8px", marginBottom: 8 }}>Personnes</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PARTY_OPTIONS.map(n => {
            const sel = pers === n;
            return (
              <button key={n} onClick={() => setPers(n)}
                style={{ minWidth: 32, height: 32, padding: "0 8px", borderRadius: 8, cursor: "pointer",
                  border: `0.5px solid ${sel ? P : BORDER}`,
                  background: sel ? PL : "white",
                  color: sel ? P : DARK,
                  fontWeight: sel ? 700 : 500, fontSize: 13, fontFamily: FONT,
                  transition: "all .15s" }}>
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Créneaux ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.8px", marginBottom: 8 }}>Créneau</div>

        <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase",
          letterSpacing: "0.6px", marginBottom: 5 }}>Déjeuner</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {LUNCH_SLOTS.map(s => {
            const sel = selSlot === s;
            return (
              <button key={s} onClick={() => setSelSlot(s)}
                style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 8,
                  cursor: "pointer", fontFamily: FONT,
                  border: `0.5px solid ${sel ? P : BORDER}`,
                  background: sel ? PL : "white",
                  color: sel ? P : DARK, transition: "all .15s" }}>
                {s}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase",
          letterSpacing: "0.6px", marginBottom: 5 }}>Dîner</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {DINNER_SLOTS.map(s => {
            const sel = selSlot === s;
            return (
              <button key={s} onClick={() => setSelSlot(s)}
                style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 8,
                  cursor: "pointer", fontFamily: FONT,
                  border: `0.5px solid ${sel ? P : BORDER}`,
                  background: sel ? PL : "white",
                  color: sel ? P : DARK, transition: "all .15s" }}>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <motion.button whileTap={{ scale: 0.97 }}
        onClick={() => selSlot && onBook({ date: selDate, slot: selSlot, pers })}
        style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
          background: selSlot ? P : BORDER, color: "white", fontSize: 14, fontWeight: 700,
          cursor: selSlot ? "pointer" : "not-allowed", fontFamily: FONT, transition: "background .2s" }}>
        {selSlot ? `Réserver — ${selSlot}` : "Choisir un créneau"}
      </motion.button>

      <p style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
        Confirmation immédiate · Annulation gratuite 24h avant
      </p>
    </div>
  );
}

export default function RestaurantDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [resto,   setResto]   = useState(null);
  usePageMeta(resto?.name, resto ? `Réservez une table chez ${resto.name} — ${resto.quartier || "Abidjan"} · TablièreCI` : undefined);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);

  // Booking state
  const [selSlot,  setSelSlot]  = useState(null);
  const [selDate,  setSelDate]  = useState(buildDays()[0].iso);
  const [pers,     setPers]     = useState(2);
  const [step,     setStep]     = useState(1);
  const [booking,  setBooking]  = useState(false);
  const [error,    setError]    = useState("");
  const [special,  setSpecial]  = useState("");
  const [resaRef,  setResaRef]  = useState(null);

  // Responsive
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    restaurantsService.getBySlug(slug)
      .then(d => setResto(d.restaurant || d))
      .catch(() => setResto(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const openModal = useCallback(({ date, slot, pers: p }) => {
    setSelDate(date); setSelSlot(slot); setPers(p);
    setModal(true); setStep(1); setError(""); setSpecial(""); setResaRef(null);
  }, []);
  const closeModal = () => { setModal(false); setStep(1); setError(""); };

  const fmtDate = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  const handleBook = async () => {
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      if (!user) { navigate("/connexion?redirect=" + encodeURIComponent(window.location.pathname)); return; }
      setBooking(true); setError("");
      try {
        const reserved_at = toDatetime(selDate, selSlot);
        const dateOnly    = selDate;
        const avail       = await restaurantsService.getAvailability(slug, dateOnly, pers).catch(() => null);
        const table       = avail?.available_tables?.[0];
        const payload     = {
          restaurant_id:   resto.id,
          reserved_at,
          party_size:      pers,
          special_request: special || undefined,
        };
        if (table) payload.table_id = table.id;
        const resa = await reservationsService.create(payload);
        setResaRef(resa?.ref || resa?.reservation?.ref || null);
        setStep(3);
      } catch (e) {
        setError(e.response?.data?.message || e.message || "Erreur lors de la réservation");
      } finally {
        setBooking(false);
      }
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: FONT, color: MUTED }}>
      Chargement…
    </div>
  );

  if (!resto) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ fontSize: 15, color: MUTED, marginBottom: 16 }}>Restaurant introuvable</div>
      <button onClick={() => navigate("/")}
        style={{ background: P, color: "white", border: "none", borderRadius: 9,
          padding: "10px 20px", cursor: "pointer", fontSize: 13, fontFamily: FONT }}>
        Retour à l'accueil
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT }}>

      {/* Nav */}
      <nav style={{ background: "white", borderBottom: `0.5px solid ${BORDER}`,
        padding: "14px 28px", display: "flex", alignItems: "center", gap: 14,
        position: "sticky", top: 0, zIndex: 20 }}>
        <button onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", cursor: "pointer", fontSize: 13, color: MUTED, fontFamily: FONT }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{resto.name}</span>
      </nav>

      {/* Photo banner */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr",
        gap: 3, height: 240, overflow: "hidden" }}>
        {[`${PL}cc`, `${PL}99`, `${PL}66`].map((c, i) => (
          <div key={i} style={{ background: c, display: "flex",
            alignItems: "center", justifyContent: "center",
            gridRow: i === 0 ? "1 / 3" : "auto", minHeight: 100 }}>
            <UtensilsCrossed size={i === 0 ? 48 : 28} color={P} style={{ opacity: 0.5 }} />
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
        gap: 28, alignItems: "start" }}>

        {/* Main */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: DARK, margin: 0 }}>{resto.name}</h1>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Stars rating={resto.rating} />
              <span style={{ fontSize: 12, color: MUTED }}>
                {resto.rating ? `${Number(resto.rating).toFixed(1)} (${resto.review_count || 0} avis)` : "Nouveau"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, color: MUTED, fontSize: 13,
            marginBottom: 18, flexWrap: "wrap" }}>
            {resto.quartier && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={13} color={P} />{resto.quartier}{resto.ville ? `, ${resto.ville}` : ""}
              </span>
            )}
            {resto.cuisine_type && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <UtensilsCrossed size={13} color={P} />{resto.cuisine_type}
              </span>
            )}
            {resto.opening_hours && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={13} color={P} />{resto.opening_hours}
              </span>
            )}
            {resto.phone && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Phone size={13} color={P} />{resto.phone}
              </span>
            )}
          </div>

          {resto.description && (
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.75, marginBottom: 22 }}>
              {resto.description}
            </p>
          )}

          {resto.price_range && (
            <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12,
              padding: "14px 18px", marginBottom: 22, display: "inline-flex",
              alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: MUTED }}>Prix moyen / personne</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: P }}>{resto.price_range}</span>
            </div>
          )}

          {/* Créneaux rapides (visible aussi sur mobile) */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: DARK,
              marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarCheck size={15} color={P} /> Créneaux disponibles aujourd'hui
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ALL_SLOTS.map((s, i) => (
                <motion.button key={i} whileTap={{ scale: 0.95 }}
                  onClick={() => openModal({ date: buildDays()[0].iso, slot: s, pers: 2 })}
                  style={{ fontSize: 13, fontWeight: 500, padding: "8px 14px",
                    borderRadius: 8, border: `0.5px solid ${P}66`,
                    background: PL, color: DARK, cursor: "pointer", fontFamily: FONT }}>
                  {s}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Sur mobile, le widget de réservation apparaît ici aussi */}
          {isMobile && (
            <div style={{ marginTop: 28 }}>
              <BookingWidget onBook={openModal} />
            </div>
          )}
        </div>

        {/* Sidebar — desktop seulement */}
        {!isMobile && <BookingWidget onBook={openModal} />}
      </div>

      {/* ── Modal réservation ── */}
      <AnimatePresence>
        {modal && (
          <>
            {/* Overlay */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal}
              style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.45)", zIndex: 50 }} />

            {/* Panel — bottom sheet sur mobile, modal centré sur desktop */}
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, y: 20, scale: 0.97 }}
              animate={isMobile ? { y: 0 }       : { opacity: 1, y: 0,  scale: 1 }}
              exit   ={isMobile ? { y: "100%" }   : { opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              style={isMobile ? {
                position: "fixed", bottom: 0, left: 0, right: 0,
                background: "white", borderRadius: "18px 18px 0 0",
                padding: "24px 24px 36px",
                zIndex: 51, fontFamily: FONT,
                maxHeight: "92vh", overflowY: "auto",
                boxShadow: "0 -8px 40px rgba(0,0,0,.18)",
              } : {
                position: "fixed",
                top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                background: "white", borderRadius: 16, padding: "32px",
                zIndex: 51, width: 440, maxWidth: "calc(100vw - 32px)",
                boxShadow: "0 12px 48px rgba(0,0,0,.2)", fontFamily: FONT,
                maxHeight: "90vh", overflowY: "auto",
              }}>

              {/* Drag handle sur mobile */}
              {isMobile && (
                <div style={{ width: 40, height: 4, borderRadius: 2, background: BORDER,
                  margin: "0 auto 20px" }} />
              )}

              <button onClick={closeModal}
                style={{ position: "absolute", top: 16, right: 16, background: "transparent",
                  border: "none", cursor: "pointer", color: MUTED }}>
                <X size={18} />
              </button>

              {/* ── Étape 3 — Succès ── */}
              {step === 3 ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: PL,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 18px" }}>
                    <CheckCircle size={30} color={P} />
                  </div>
                  <h3 style={{ fontSize: 19, fontWeight: 700, color: DARK, marginBottom: 8 }}>
                    Réservation envoyée !
                  </h3>
                  {resaRef && (
                    <div style={{ fontSize: 12, color: MUTED, fontFamily: "monospace", marginBottom: 8 }}>
                      Réf. {resaRef}
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, marginBottom: 26 }}>
                    <strong style={{ color: DARK }}>{resto.name}</strong><br />
                    {fmtDate(selDate)} · {selSlot} · {pers} personne{pers > 1 ? "s" : ""}
                  </p>
                  <p style={{ fontSize: 12, color: MUTED, marginBottom: 24, lineHeight: 1.5 }}>
                    Le restaurant confirmera votre réservation par SMS ou email.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button onClick={() => { closeModal(); navigate("/profil"); }}
                      style={{ background: PL, color: P, border: `0.5px solid ${P}`,
                        borderRadius: 9, padding: "10px 18px", fontSize: 13,
                        fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                      Mes réservations
                    </button>
                    <button onClick={() => { closeModal(); navigate("/"); }}
                      style={{ background: P, color: "white", border: "none",
                        borderRadius: 9, padding: "10px 18px", fontSize: 13,
                        fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                      Retour à l'accueil
                    </button>
                  </div>
                </div>

              ) : step === 2 ? (
                /* ── Étape 2 — Confirmation ── */
                <>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: DARK, marginBottom: 20 }}>
                    Confirmer la réservation
                  </h3>

                  {/* Résumé visuel */}
                  <div style={{ background: PL, borderRadius: 12, padding: "16px",
                    marginBottom: 18, border: `0.5px solid ${P}44` }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 4 }}>
                      {resto.name}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                      {[
                        { icon: Calendar, label: fmtDate(selDate) },
                        { icon: Clock,    label: selSlot },
                        { icon: Users,    label: `${pers} personne${pers > 1 ? "s" : ""}` },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6,
                          background: "white", borderRadius: 8, padding: "6px 10px",
                          fontSize: 12, color: DARK, fontWeight: 600 }}>
                          <Icon size={13} color={P} /> {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Demande spéciale */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 10, color: MUTED, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.8px",
                      display: "block", marginBottom: 6 }}>
                      Demande spéciale (optionnel)
                    </label>
                    <textarea value={special} onChange={e => setSpecial(e.target.value)}
                      placeholder="Anniversaire, allergie, chaise haute…"
                      rows={2}
                      style={{ width: "100%", border: `0.5px solid ${BORDER}`,
                        borderRadius: 9, padding: "9px 12px", fontSize: 13,
                        color: DARK, background: BG, outline: "none",
                        fontFamily: FONT, resize: "none", boxSizing: "border-box" }} />
                  </div>

                  {!user && (
                    <div style={{ marginBottom: 14, padding: "9px 12px", background: PL,
                      borderRadius: 8, fontSize: 12, color: "#C47D1A" }}>
                      Vous serez redirigé vers la connexion pour finaliser.
                    </div>
                  )}

                  {error && (
                    <div style={{ marginBottom: 14, padding: "9px 12px", background: "#FAECE7",
                      borderRadius: 8, fontSize: 12, color: "#993C1D" }}>{error}</div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setStep(1)}
                      style={{ flex: 1, padding: "12px 0", borderRadius: 10,
                        border: `0.5px solid ${BORDER}`, background: "white",
                        color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
                      Retour
                    </button>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={handleBook} disabled={booking}
                      style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none",
                        background: booking ? MUTED : P, color: "white",
                        fontSize: 14, fontWeight: 700,
                        cursor: booking ? "not-allowed" : "pointer", fontFamily: FONT }}>
                      {booking ? "Envoi en cours…" : "Confirmer la réservation"}
                    </motion.button>
                  </div>
                </>

              ) : (
                /* ── Étape 1 — Récap créneau sélectionné ── */
                <>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: DARK, marginBottom: 4 }}>
                    Réserver une table
                  </h3>
                  <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{resto.name}</p>

                  {/* Résumé sélection */}
                  <div style={{ background: PL, borderRadius: 10, padding: "12px 16px",
                    marginBottom: 20, display: "flex", gap: 12, fontSize: 13,
                    alignItems: "center", flexWrap: "wrap",
                    border: `0.5px solid ${P}44` }}>
                    <span style={{ fontWeight: 700, color: P }}>{selSlot}</span>
                    <span style={{ color: DARK }}>{fmtDate(selDate)}</span>
                    <span style={{ color: MUTED }}>{pers} pers.</span>
                  </div>

                  {/* Changer de créneau inline */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 10, color: MUTED, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                      Changer de créneau
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase",
                      letterSpacing: "0.6px", marginBottom: 5 }}>Déjeuner</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                      {LUNCH_SLOTS.map((s, i) => (
                        <button key={i} onClick={() => setSelSlot(s)}
                          style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px",
                            borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                            border: `0.5px solid ${selSlot === s ? P : BORDER}`,
                            background: selSlot === s ? PL : "white",
                            color: selSlot === s ? P : MUTED }}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase",
                      letterSpacing: "0.6px", marginBottom: 5 }}>Dîner</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {DINNER_SLOTS.map((s, i) => (
                        <button key={i} onClick={() => setSelSlot(s)}
                          style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px",
                            borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                            border: `0.5px solid ${selSlot === s ? P : BORDER}`,
                            background: selSlot === s ? PL : "white",
                            color: selSlot === s ? P : MUTED }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={handleBook}
                    style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
                      background: P, color: "white", fontSize: 14, fontWeight: 700,
                      cursor: "pointer", fontFamily: FONT }}>
                    Continuer
                  </motion.button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
