import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, MapPin, Clock, Users, Calendar,
  UtensilsCrossed, CheckCircle, X, CalendarCheck, Phone,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { restaurantsService } from "../../services/restaurants.service.js";
import { reservationsService } from "../../services/reservations.service.js";
import { menuService } from "../../services/menu.service.js";
import Stories from "../../components/Stories.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { usePageMeta } from "../../hooks/usePageMeta.js";
const MapView = lazy(() => import("../../components/MapView.jsx"));

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

const pad = n => String(n).padStart(2, "0");

/** Formate une date locale en YYYY-MM-DD sans conversion UTC */
function localIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

/** Génère les 14 prochains jours — dates locales (évite décalage UTC) */
function buildDays() {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      iso: localIso(d),          // ← local, pas UTC (évite bug July 3 → July 2)
      dayName: DAYS_FR[d.getDay()],
      dayNum: d.getDate(),
      month: MONTHS_FR[d.getMonth()],
      isToday: i === 0,
    });
  }
  return days;
}

/** Convertit date locale + heure en ISO sans perdre le jour local */
function toDatetime(isoDate, timeStr) {
  const match = timeStr.match(/^(\d+)h(\d*)$/);
  if (!match) return new Date().toISOString();
  // Construction locale pour éviter le décalage UTC
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d, parseInt(match[1]), parseInt(match[2] || "0"), 0, 0);
  return dt.toISOString();
}

/** Créneau déjà passé ? */
function isPastSlot(isoDate, timeStr) {
  const match = timeStr.match(/^(\d+)h(\d*)$/);
  if (!match) return false;
  const [y, m, d] = isoDate.split("-").map(Number);
  const slotTime = new Date(y, m - 1, d, parseInt(match[1]), parseInt(match[2] || "0"), 0, 0);
  return slotTime <= new Date();
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
function BookingWidget({ onBook, initialDate, initialGuests }) {
  const DAYS = buildDays();
  // Pré-remplissage depuis la recherche d'accueil, avec garde-fous :
  // la date n'est retenue que si elle appartient à la fenêtre proposée.
  const validInitial = initialDate && DAYS.some(d => d.iso === initialDate) ? initialDate : DAYS[0].iso;
  const initGuests = Math.min(20, Math.max(1, parseInt(initialGuests, 10) || 2));
  const [selDate, setSelDate] = useState(validInitial);
  const [selSlot, setSelSlot] = useState(null);
  const [pers,    setPers]    = useState(initGuests);
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
            const sel  = selSlot === s;
            const past = isPastSlot(selDate, s);
            return (
              <button key={s} onClick={() => !past && setSelSlot(s)}
                disabled={past}
                title={past ? "Créneau passé" : ""}
                style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 8,
                  cursor: past ? "not-allowed" : "pointer", fontFamily: FONT,
                  border: `0.5px solid ${sel ? P : past ? "#eee" : BORDER}`,
                  background: sel ? PL : past ? "#f8f8f8" : "white",
                  color: sel ? P : past ? "#ccc" : DARK,
                  textDecoration: past ? "line-through" : "none",
                  transition: "all .15s" }}>
                {s}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase",
          letterSpacing: "0.6px", marginBottom: 5 }}>Dîner</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {DINNER_SLOTS.map(s => {
            const sel  = selSlot === s;
            const past = isPastSlot(selDate, s);
            return (
              <button key={s} onClick={() => !past && setSelSlot(s)}
                disabled={past}
                title={past ? "Créneau passé" : ""}
                style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 8,
                  cursor: past ? "not-allowed" : "pointer", fontFamily: FONT,
                  border: `0.5px solid ${sel ? P : past ? "#eee" : BORDER}`,
                  background: sel ? PL : past ? "#f8f8f8" : "white",
                  color: sel ? P : past ? "#ccc" : DARK,
                  textDecoration: past ? "line-through" : "none",
                  transition: "all .15s" }}>
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

// Lien "Ajouter à Google Agenda" à partir de la réservation
function calendarUrl(resto, dateIso, slot, pers) {
  if (!dateIso || !slot) return null;
  const [h, m] = slot.replace("h", ":").split(":").map(Number);
  const day = dateIso.replace(/-/g, "");
  const pad = (n) => String(n).padStart(2, "0");
  const start = `${day}T${pad(h)}${pad(m || 0)}00`;
  const end   = `${day}T${pad((h + 2) % 24)}${pad(m || 0)}00`;
  const text    = encodeURIComponent(`Réservation — ${resto?.name || "Restaurant"}`);
  const details = encodeURIComponent(`Table pour ${pers} personne(s) — réservé via TablièreCI (tabliereci.net)`);
  const loc     = encodeURIComponent(resto?.address || resto?.quartier || "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${loc}`;
}

/* Contenu des étapes partagé mobile/desktop */
function ModalSteps({ step, setStep, selSlot, setSelSlot, selDate, fmtDate, pers, resto,
  special, setSpecial, user, error, booking, handleBook, closeModal, navigate,
  resaRef, P, PL, DARK, BG, BORDER, MUTED, FONT,
  guestName, setGuestName, guestPhone, setGuestPhone, guestEmail, setGuestEmail }) {
  return (
    <>
      <button onClick={closeModal}
        style={{ position: "absolute", top: 14, right: 14, background: "transparent",
          border: "none", cursor: "pointer", color: MUTED, zIndex: 1, padding: 4 }}>
        <X size={18} />
      </button>

      {step === 3 ? (
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <motion.div
            initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            style={{ width: 64, height: 64, borderRadius: "50%", background: PL,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <CheckCircle size={32} color={P} />
          </motion.div>
          <motion.h3 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ fontSize: 19, fontWeight: 700, color: DARK, marginBottom: 8 }}>Réservation envoyée !</motion.h3>
          {resaRef && <div style={{ fontSize: 12, color: MUTED, fontFamily: "monospace", marginBottom: 8 }}>Réf. {resaRef}</div>}
          <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, marginBottom: 26 }}>
            <strong style={{ color: DARK }}>{resto.name}</strong><br />
            {fmtDate(selDate)} · {selSlot} · {pers} personne{pers > 1 ? "s" : ""}
          </p>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 24, lineHeight: 1.5 }}>
            Le restaurant confirmera votre réservation par SMS ou email.
          </p>
          {/* Message de dépôt / arrhes configuré par le restaurant, affiché si le
              nombre de personnes atteint le seuil défini par l'établissement */}
          {resto.deposit_enabled && pers >= (resto.deposit_min_party || 6) && resto.deposit_message && (
            <div style={{ textAlign: "left", background: PL, border: `1px solid ${P}`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P, marginBottom: 6 }}>
                Dépôt requis pour cette réservation
              </div>
              <div style={{ fontSize: 13, color: DARK, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {resto.deposit_message}
              </div>
            </div>
          )}
          {/* Ajouter au calendrier (Google Agenda) */}
          {calendarUrl(resto, selDate, selSlot, pers) && (
            <a href={calendarUrl(resto, selDate, selSlot, pers)} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 16,
                background: "white", color: DARK, border: `0.5px solid ${BORDER}`, borderRadius: 9,
                padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: FONT, textDecoration: "none" }}>
              <CalendarCheck size={15} color={P} /> Ajouter au calendrier
            </a>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => { closeModal(); navigate("/profil"); }}
              style={{ background: PL, color: P, border: `0.5px solid ${P}`, borderRadius: 9,
                padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              Mes réservations
            </button>
            <button onClick={() => { closeModal(); navigate("/"); }}
              style={{ background: P, color: "white", border: "none", borderRadius: 9,
                padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              Retour à l'accueil
            </button>
          </div>
        </div>

      ) : step === 2 ? (
        <>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: DARK, marginBottom: 18 }}>Confirmer la réservation</h3>
          <div style={{ background: PL, borderRadius: 12, padding: "14px 16px", marginBottom: 16, border: `0.5px solid ${P}44` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 8 }}>{resto.name}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[{ icon: Calendar, label: fmtDate(selDate) }, { icon: Clock, label: selSlot }, { icon: Users, label: `${pers} personne${pers > 1 ? "s" : ""}` }]
                .map(({ icon: Icon, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, background: "white",
                    borderRadius: 8, padding: "5px 9px", fontSize: 12, color: DARK, fontWeight: 600 }}>
                    <Icon size={12} color={P} /> {label}
                  </div>
                ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>Demande spéciale (optionnel)</label>
            <textarea value={special} onChange={e => setSpecial(e.target.value)}
              placeholder="Anniversaire, allergie, chaise haute…" rows={2}
              style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
                padding: "9px 12px", fontSize: 13, color: DARK, background: BG, outline: "none",
                fontFamily: FONT, resize: "none", boxSizing: "border-box" }} />
          </div>
          {/* Formulaire invité si non connecté */}
          {!user && (
            <div style={{ background: "#FFF9F0", border: `0.5px solid ${P}44`,
              borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 3 }}>
                Vos coordonnées
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>
                Ces infos restent confidentielles. Aucun compte créé.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={guestName} onChange={e => setGuestName(e.target.value)}
                  placeholder="Nom complet *" required
                  style={{ border: `0.5px solid ${guestName ? P : BORDER}`, borderRadius: 8,
                    padding: "11px 12px", fontSize: 14, background: BG, outline: "none",
                    color: DARK, fontFamily: FONT, width: "100%", boxSizing: "border-box" }} />
                <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                  placeholder="Téléphone *" type="tel" required
                  style={{ border: `0.5px solid ${guestPhone ? P : BORDER}`, borderRadius: 8,
                    padding: "11px 12px", fontSize: 14, background: BG, outline: "none",
                    color: DARK, fontFamily: FONT, width: "100%", boxSizing: "border-box" }} />
                <input value={guestEmail || ""} onChange={e => setGuestEmail && setGuestEmail(e.target.value)}
                  placeholder="E-mail (optionnel)" type="email"
                  style={{ border: `0.5px solid ${BORDER}`, borderRadius: 8,
                    padding: "11px 12px", fontSize: 14, background: BG, outline: "none",
                    color: DARK, fontFamily: FONT, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginTop: 10, padding: "8px 10px", background: PL,
                borderRadius: 7, fontSize: 11, color: "#C47D1A" }}>
                <strong>Créez un compte gratuitement</strong> pour suivre vos réservations, les annuler facilement et cumuler des points.{" "}
                <span onClick={() => navigate("/inscription")}
                  style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}>
                  S'inscrire →
                </span>
              </div>
            </div>
          )}
          {error && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#FAECE7", borderRadius: 8, fontSize: 12, color: "#993C1D" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)}
              style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: `0.5px solid ${BORDER}`,
                background: "white", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
              Retour
            </button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleBook} disabled={booking}
              style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none",
                background: booking ? MUTED : P, color: "white", fontSize: 14, fontWeight: 700,
                cursor: booking ? "not-allowed" : "pointer", fontFamily: FONT }}>
              {booking ? "Envoi en cours…" : "Confirmer la réservation"}
            </motion.button>
          </div>
        </>

      ) : (
        <>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: DARK, marginBottom: 4 }}>Réserver une table</h3>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>{resto.name}</p>
          <div style={{ background: PL, borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            display: "flex", gap: 12, fontSize: 13, alignItems: "center", flexWrap: "wrap", border: `0.5px solid ${P}44` }}>
            <span style={{ fontWeight: 700, color: P }}>{selSlot}</span>
            <span style={{ color: DARK }}>{fmtDate(selDate)}</span>
            <span style={{ color: MUTED }}>{pers} pers.</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Changer de créneau</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 5 }}>Déjeuner</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
              {LUNCH_SLOTS.map(s => (
                <button key={s} onClick={() => setSelSlot(s)}
                  style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                    border: `0.5px solid ${selSlot === s ? P : BORDER}`, background: selSlot === s ? PL : "white", color: selSlot === s ? P : MUTED }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 5 }}>Dîner</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {DINNER_SLOTS.map(s => (
                <button key={s} onClick={() => setSelSlot(s)}
                  style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                    border: `0.5px solid ${selSlot === s ? P : BORDER}`, background: selSlot === s ? PL : "white", color: selSlot === s ? P : MUTED }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleBook}
            style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
              background: P, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            Continuer
          </motion.button>
        </>
      )}
    </>
  );
}

export default function RestaurantDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Contexte de réservation transmis depuis la recherche d'accueil (pré-remplissage)
  const prefillDate   = searchParams.get("date")   || undefined;
  const prefillGuests = searchParams.get("guests") || undefined;
  const preview       = searchParams.get("preview") || undefined; // aperçu privé propriétaire

  const [resto,   setResto]   = useState(null);
  const [menu,    setMenu]    = useState(null); // catégories du menu si menu_public
  const [tab,     setTab]     = useState("reserver"); // reserver | menu
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

  // Reviews
  const [reviews,   setReviews]   = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [myReview,  setMyReview]  = useState(null);
  const [reviewForm,setReviewForm]= useState({ rating: 0, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg,        setReviewMsg]        = useState("");

  // Modération UGC : masquer / signaler un avis
  const [hiddenReviews, setHiddenReviews] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tci_hidden_reviews") || "[]")); } catch { return new Set(); }
  });
  const [reportedReviews, setReportedReviews] = useState(new Set());
  const hideReview = (id) => {
    setHiddenReviews(prev => {
      const n = new Set(prev); n.add(id);
      try { localStorage.setItem("tci_hidden_reviews", JSON.stringify([...n])); } catch {}
      return n;
    });
  };
  const reportReview = (id) => {
    setReportedReviews(prev => new Set(prev).add(id));
    api.post("/reports", { type: "review", target_id: id }).catch(() => {});
  };

  // Galerie photos avec swipe
  const [photoIdx, setPhotoIdx] = useState(0);
  const touchStartX = useRef(null);
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e, photos) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) setPhotoIdx(i => Math.min(photos.length - 1, i + 1));
      else          setPhotoIdx(i => Math.max(0, i - 1));
    }
    touchStartX.current = null;
  };

  // Responsive
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    restaurantsService.getBySlug(slug, preview)
      .then(d => {
        const r = d.restaurant || d;
        setResto(r);
        // Menu public : on le charge si le restaurant l'a activé
        if (r?.menu_public && r?.slug) {
          menuService.getPublicMenu(r.slug)
            .then(m => setMenu((m.categories || []).filter(c => (c.items || []).length > 0)))
            .catch(() => {});
        }
      })
      .catch(() => setResto(null))
      .finally(() => setLoading(false));

    // Charger les avis
    import("../../services/api.js").then(({ default: api }) => {
      api.get(`/restaurants/${slug}/reviews`, { params: { limit: 20 } })
        .then(r => setReviews(r.data?.data || []))
        .catch(() => {});
      if (user) {
        api.get(`/restaurants/${slug}/reviews/can-review`)
          .then(r => {
            setCanReview(r.data?.data?.can_review || false);
            setMyReview(r.data?.data?.existing_review || null);
            if (r.data?.data?.existing_review) {
              setReviewForm({ rating: r.data.data.existing_review.rating, comment: r.data.data.existing_review.comment || "" });
            }
          })
          .catch(() => {});
      }
    });
  }, [slug, user]);

  const openModal = useCallback(({ date, slot, pers: p }) => {
    setSelDate(date); setSelSlot(slot); setPers(p);
    setModal(true); setStep(1); setError(""); setSpecial(""); setResaRef(null);
  }, []);
  const closeModal = () => { setModal(false); setStep(1); setError(""); };

  // Pré-ouverture de la réservation depuis les créneaux cliqués sur l'accueil
  const slotOpenedRef = useRef(false);
  useEffect(() => {
    if (slotOpenedRef.current || !resto) return;
    const slot = searchParams.get("slot");
    if (!slot) return;
    slotOpenedRef.current = true;
    const days = buildDays();
    const date = (prefillDate && days.some(d => d.iso === prefillDate)) ? prefillDate : days[0].iso;
    const p = Math.max(1, parseInt(prefillGuests, 10) || 2);
    openModal({ date, slot, pers: p });
  }, [resto, searchParams, prefillDate, prefillGuests, openModal]);

  // Verrouiller le scroll de l'arrière-plan quand la modale est ouverte
  // (sinon, sur mobile, la page derrière défilait au lieu du contenu de la modale)
  useEffect(() => {
    if (!modal) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [modal]);

  const fmtDate = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  // Infos invité
  const [guestName,  setGuestName]  = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const handleBook = async () => {
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      // Invité sans compte : nom + téléphone obligatoires
      if (!user && !guestName.trim()) { setError("Veuillez indiquer votre nom complet."); return; }
      if (!user && !guestPhone.trim()) { setError("Veuillez indiquer votre numéro de téléphone."); return; }
      setBooking(true); setError("");
      try {
        const reserved_at = toDatetime(selDate, selSlot);
        const dateOnly    = selDate;
        // Récupérer une table libre à CET horaire (tient compte de la durée d'assise :
        // une table occupée se libère après la durée → pas de double réservation).
        const avail = await restaurantsService.getAvailability(slug, dateOnly, pers, reserved_at, preview).catch(() => null);
        const table = avail?.available_tables?.[0] || null;

        const payload     = {
          restaurant_id:   resto.id,
          reserved_at,
          party_size:      pers,
          special_request: special || undefined,
        };
        if (table) payload.table_id = table.id;
        // Réservation invité — walk_in fields
        if (!user) {
          payload.walk_in_name  = guestName.trim();
          payload.walk_in_phone = guestPhone.trim() || undefined;
        }
        const headers = user ? {} : {}; // appel sans auth si invité
        const resa = user
          ? await reservationsService.create(payload)
          : await import("../../services/api.js").then(({ default: api }) =>
              api.post("/reservations/guest", {
                ...payload,
                walk_in_email: guestEmail.trim() || undefined,
              }).then(r => r.data.data)
            );
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

      {/* Bandeau aperçu privé (propriétaire) */}
      {preview && (
        <div style={{ background: "#1E2E28", color: "#FEF6EC", fontSize: 12.5, fontWeight: 600,
          textAlign: "center", padding: "8px 14px" }}>
          Aperçu privé — cette page n'est pas encore visible publiquement. Publiez-la depuis votre profil pour la mettre en ligne.
        </div>
      )}

      {/* Nav */}
      <nav style={{ background: "white", borderBottom: `0.5px solid ${BORDER}`,
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 28px 14px",
        display: "flex", alignItems: "center", gap: 14,
        position: "sticky", top: 0, zIndex: 20 }}>
        <button onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", cursor: "pointer", fontSize: 13, color: MUTED, fontFamily: FONT }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{resto.name}</span>
      </nav>

      {/* Photo gallery */}
      {(() => {
        const photos = Array.isArray(resto.photos) && resto.photos.length > 0 ? resto.photos : null;
        if (photos) {
          return (
            <div style={{ position: "relative", height: 280, overflow: "hidden", background: "#1E2E28" }}>
              <img src={photos[photoIdx]} alt={`${resto.name} photo ${photoIdx + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity .3s" }}
                onTouchStart={handleTouchStart}
                onTouchEnd={e => handleTouchEnd(e, photos)} />
              {photos.length > 1 && (
                <>
                  <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
                    display: "flex", gap: 6 }}>
                    {photos.map((_, i) => (
                      <button key={i} onClick={() => setPhotoIdx(i)}
                        style={{ width: i === photoIdx ? 20 : 7, height: 7, borderRadius: 4,
                          background: i === photoIdx ? P : "rgba(255,255,255,.5)",
                          border: "none", cursor: "pointer", padding: 0, transition: "all .2s" }} />
                    ))}
                  </div>
                  <div style={{ position: "absolute", bottom: 12, right: 14,
                    background: "rgba(0,0,0,.5)", color: "white", borderRadius: 20,
                    padding: "2px 9px", fontSize: 11 }}>
                    {photoIdx + 1}/{photos.length}
                  </div>
                </>
              )}
            </div>
          );
        }
        return (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr",
            gap: 3, height: 240, overflow: "hidden" }}>
            {[`${PL}cc`, `${PL}99`, `${PL}66`].map((c, i) => (
              <div key={i} style={{ background: c, display: "flex", alignItems: "center",
                justifyContent: "center", gridRow: i === 0 ? "1 / 3" : "auto", minHeight: 100 }}>
                <UtensilsCrossed size={i === 0 ? 48 : 28} color={P} style={{ opacity: 0.5 }} />
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Instants — juste sous les photos, au-dessus du nom ── */}
      <div style={{ padding: "16px 0 4px" }}>
        <Stories slug={slug} />
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

          {/* ── Onglets Réserver / Menu (toujours affichés) ── */}
          <div style={{ display: "flex", gap: 4, marginBottom: 22, borderBottom: `0.5px solid ${BORDER}` }}>
            {[["reserver", "Réserver"], ["menu", "Menu"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: FONT,
                  padding: "10px 18px", fontSize: 14, fontWeight: tab === k ? 700 : 500,
                  color: tab === k ? DARK : MUTED,
                  borderBottom: tab === k ? `2px solid ${P}` : "2px solid transparent", marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Onglet Réserver — créneaux + widget mobile */}
          {tab === "reserver" && (
            <>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: DARK,
                  marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <CalendarCheck size={15} color={P} /> Créneaux disponibles aujourd'hui
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(() => {
                    const todayIso = buildDays()[0].iso;
                    const upcoming = ALL_SLOTS.filter(s => !isPastSlot(todayIso, s));
                    if (upcoming.length === 0) {
                      return (
                        <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>
                          Plus de créneaux aujourd'hui — choisissez une autre date dans le formulaire de réservation.
                        </div>
                      );
                    }
                    return upcoming.map((s, i) => (
                      <motion.button key={i} whileTap={{ scale: 0.95 }}
                        onClick={() => openModal({ date: todayIso, slot: s, pers: 2 })}
                        style={{ fontSize: 13, fontWeight: 500, padding: "8px 14px",
                          borderRadius: 8, border: `0.5px solid ${P}66`,
                          background: PL, color: DARK, cursor: "pointer", fontFamily: FONT }}>
                        {s}
                      </motion.button>
                    ));
                  })()}
                </div>
              </div>
              {isMobile && (
                <div style={{ marginTop: 28 }}>
                  <BookingWidget onBook={openModal} initialDate={prefillDate} initialGuests={prefillGuests} />
                </div>
              )}
            </>
          )}

          {/* Onglet Menu — état vide si pas encore publié */}
          {tab === "menu" && (!menu || menu.length === 0) && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED }}>
              <UtensilsCrossed size={30} color={BORDER} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14 }}>Le menu n'est pas encore disponible.</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Réservez votre table dès maintenant.</div>
            </div>
          )}
          {tab === "menu" && menu && menu.length > 0 && (
            <div>
              {menu.map((cat) => (
                <div key={cat.id} style={{ marginBottom: 26 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P, textTransform: "uppercase",
                    letterSpacing: "0.6px", marginBottom: 12 }}>{cat.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                    {(cat.items || []).map((it) => (
                      <div key={it.id} style={{ background: "white", border: `0.5px solid ${BORDER}`,
                        borderRadius: 12, overflow: "hidden", display: "flex", gap: 12 }}>
                        {it.image_url && (
                          <img src={it.image_url} alt={it.name} loading="lazy"
                            style={{ width: 92, height: 92, objectFit: "cover", flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, padding: "12px 14px", minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{it.name}</span>
                            {it.price != null && (
                              <span style={{ fontSize: 14, fontWeight: 700, color: P, whiteSpace: "nowrap" }}>
                                {Number(it.price).toLocaleString("fr-FR")} F
                              </span>
                            )}
                          </div>
                          {it.description && (
                            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>{it.description}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — desktop seulement */}
        {!isMobile && <BookingWidget onBook={openModal} initialDate={prefillDate} initialGuests={prefillGuests} />}
      </div>

      {/* ── Où nous trouver (carte) — si coordonnées précises ── */}
      {resto.latitude && resto.longitude && (
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px 8px" }}>
          <div style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: DARK, margin: "0 0 4px" }}>Où nous trouver</h2>
            {resto.address && (
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={13} color={P} /> {resto.address}{resto.quartier ? `, ${resto.quartier}` : ""}
              </div>
            )}
            <div style={{ height: 300, borderRadius: 14, overflow: "hidden", border: `0.5px solid ${BORDER}` }}>
              <Suspense fallback={<div style={{ height: "100%", background: BG }} />}>
                <MapView restaurants={[resto]} onSelect={() => {}} />
              </Suspense>
            </div>
            <a href={`https://www.google.com/maps/search/?api=1&query=${resto.latitude},${resto.longitude}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 600, color: P, textDecoration: "none" }}>
              Ouvrir dans Google Maps →
            </a>
          </div>
        </div>
      )}

      {/* ── Section Avis ── */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px 60px" }}>
        <div style={{ borderTop: `0.5px solid ${BORDER}`, paddingTop: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: DARK, margin: "0 0 4px" }}>
                Avis clients
              </h2>
              {resto.review_count > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Stars rating={resto.rating} />
                  <span style={{ fontSize: 14, color: DARK, fontWeight: 600 }}>
                    {Number(resto.rating || 0).toFixed(1)}
                  </span>
                  <span style={{ color: MUTED, fontSize: 13 }}>
                    ({resto.review_count} avis)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Formulaire avis */}
          {canReview && (
            <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 14,
              padding: "20px 20px", marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: DARK, marginBottom: 14 }}>
                {myReview ? "Modifier votre avis" : "Laisser un avis"}
              </div>
              {/* Étoiles */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setReviewForm(p => ({ ...p, rating: i }))}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill={i <= reviewForm.rating ? P : "none"}
                      stroke={P} strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                ))}
                {reviewForm.rating > 0 && (
                  <span style={{ marginLeft: 6, color: MUTED, fontSize: 13, alignSelf: "center" }}>
                    {["","Mauvais","Moyen","Bien","Très bien","Excellent"][reviewForm.rating]}
                  </span>
                )}
              </div>
              <textarea value={reviewForm.comment}
                onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                placeholder="Partagez votre expérience (optionnel)…"
                rows={3}
                style={{ width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9,
                  padding: "10px 12px", fontSize: 13, color: DARK, background: BG,
                  outline: "none", fontFamily: FONT, resize: "none", boxSizing: "border-box",
                  marginBottom: 12 }} />
              {reviewMsg && (
                <div style={{ fontSize: 12, color: reviewMsg.includes("succès") ? "#1D9E75" : "#DC2626",
                  marginBottom: 8 }}>{reviewMsg}</div>
              )}
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  if (!reviewForm.rating) { setReviewMsg("Veuillez sélectionner une note"); return; }
                  setSubmittingReview(true); setReviewMsg("");
                  try {
                    const { default: api } = await import("../../services/api.js");
                    const r = await api.post(`/restaurants/${slug}/reviews`, reviewForm);
                    setMyReview(r.data?.data?.review);
                    setReviewMsg("Avis publié avec succès !");
                    // Recharger les avis
                    const list = await api.get(`/restaurants/${slug}/reviews`);
                    setReviews(list.data?.data || []);
                  } catch (e) {
                    setReviewMsg(e.response?.data?.message || "Erreur lors de la publication");
                  }
                  setSubmittingReview(false);
                }}
                disabled={submittingReview || !reviewForm.rating}
                style={{ background: P, color: "#1A1000", border: "none", borderRadius: 9,
                  padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  opacity: !reviewForm.rating ? 0.5 : 1, fontFamily: FONT }}>
                {submittingReview ? "Publication…" : myReview ? "Mettre à jour" : "Publier"}
              </motion.button>
            </div>
          )}

          {/* Liste avis */}
          {reviews.filter(rv => !hiddenReviews.has(rv.id)).length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: MUTED, fontSize: 14 }}>
              Aucun avis pour ce restaurant. Soyez le premier à partager votre expérience !
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {reviews.filter(rv => !hiddenReviews.has(rv.id)).map((rv, i) => (
                <motion.div key={rv.id || i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12,
                    padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                    {rv.client_avatar ? (
                      <img src={rv.client_avatar} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: PL,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, color: P, flexShrink: 0 }}>
                        {(rv.client_name || "?").slice(0,1).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: DARK }}>
                          {rv.client_name || "Client"}
                        </span>
                        <div style={{ display: "flex", gap: 2 }}>
                          {[1,2,3,4,5].map(i => (
                            <svg key={i} width="13" height="13" viewBox="0 0 24 24"
                              fill={i <= rv.rating ? P : "none"} stroke={P} strokeWidth="1.5">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </div>
                        <span style={{ fontSize: 11, color: MUTED }}>
                          {new Date(rv.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {rv.comment && (
                    <p style={{ fontSize: 13, color: "#555", lineHeight: 1.65, margin: 0 }}>
                      {rv.comment}
                    </p>
                  )}
                  {/* Modération UGC : signaler / masquer */}
                  <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "flex-end" }}>
                    {reportedReviews.has(rv.id) ? (
                      <span style={{ fontSize: 11, color: "#1e7d4f" }}>✓ Avis signalé</span>
                    ) : (
                      <button onClick={() => reportReview(rv.id)}
                        style={{ border: "none", background: "transparent", cursor: "pointer",
                          fontSize: 11, color: MUTED }}>
                        Signaler
                      </button>
                    )}
                    <button onClick={() => hideReview(rv.id)}
                      style={{ border: "none", background: "transparent", cursor: "pointer",
                        fontSize: 11, color: MUTED }}>
                      Masquer
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal réservation ── */}
      <AnimatePresence>
        {modal && (
          <>
            {/* Overlay */}
            <motion.div key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal}
              style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.45)", zIndex: 50 }} />

            {/* Mobile — bottom sheet */}
            {isMobile && (
              <motion.div key="sheet"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 340, damping: 32 }}
                style={{ position: "fixed",
                  bottom: "calc(62px + env(safe-area-inset-bottom, 0px))",
                  left: 0, right: 0, zIndex: 95,
                  background: "white", borderRadius: "18px 18px 0 0", fontFamily: FONT,
                  display: "flex", flexDirection: "column",
                  maxHeight: "calc(92vh - 62px - env(safe-area-inset-bottom, 0px))",
                  boxShadow: "0 -8px 40px rgba(0,0,0,.18)" }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: BORDER, margin: "12px auto 8px", flexShrink: 0 }} />
                <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 20px",
                  overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
                <ModalSteps
                  step={step} setStep={setStep} selSlot={selSlot} setSelSlot={setSelSlot}
                  selDate={selDate} fmtDate={fmtDate} pers={pers} resto={resto}
                  special={special} setSpecial={setSpecial} user={user}
                  error={error} booking={booking} handleBook={handleBook}
                  closeModal={closeModal} navigate={navigate}
                  resaRef={resaRef} P={P} PL={PL} DARK={DARK} BG={BG} BORDER={BORDER} MUTED={MUTED} FONT={FONT}
                  guestName={guestName} setGuestName={setGuestName}
                  guestPhone={guestPhone} setGuestPhone={setGuestPhone}
                  guestEmail={guestEmail} setGuestEmail={setGuestEmail}
                />
                </div>
              </motion.div>
            )}

            {/* Desktop — flexbox centré (pas de transform conflictuel) */}
            {!isMobile && (
              <div key="desktop"
                style={{ position: "fixed", inset: 0, zIndex: 51,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 16, pointerEvents: "none" }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  style={{ background: "white", borderRadius: 16, padding: "32px",
                    width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto",
                    overscrollBehavior: "contain",
                    boxShadow: "0 12px 48px rgba(0,0,0,.2)", fontFamily: FONT,
                    pointerEvents: "auto", position: "relative" }}>
                  <ModalSteps
                    step={step} setStep={setStep} selSlot={selSlot} setSelSlot={setSelSlot}
                    selDate={selDate} fmtDate={fmtDate} pers={pers} resto={resto}
                    special={special} setSpecial={setSpecial} user={user}
                    error={error} booking={booking} handleBook={handleBook}
                    closeModal={closeModal} navigate={navigate}
                    resaRef={resaRef} P={P} PL={PL} DARK={DARK} BG={BG} BORDER={BORDER} MUTED={MUTED} FONT={FONT}
                  />
                </motion.div>
              </div>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
