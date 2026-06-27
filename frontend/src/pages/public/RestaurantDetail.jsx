import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, MapPin, Clock, Users, Calendar,
  UtensilsCrossed, CheckCircle, X, CalendarCheck, Phone,
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

const TIME_SLOTS = ["12h00","12h30","13h00","13h30","19h00","19h30","20h00","20h30","21h00","21h30","22h00"];

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

function toDatetime(dateStr, timeStr) {
  const today    = new Date();
  const base     = new Date(today);
  if (dateStr === "Demain") base.setDate(today.getDate() + 1);
  else if (dateStr === "Ce weekend") {
    const day = today.getDay();
    const diff = day <= 5 ? 6 - day : 7;
    base.setDate(today.getDate() + diff);
  }
  const match = timeStr.match(/^(\d+)h(\d*)$/);
  if (!match) return new Date().toISOString();
  const dt = new Date(base);
  dt.setHours(parseInt(match[1]), parseInt(match[2] || "0"), 0, 0);
  return dt.toISOString();
}

export default function RestaurantDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [resto,     setResto]     = useState(null);
  usePageMeta(resto?.name, resto ? `Réservez une table chez ${resto.name} — ${resto.quartier || "Abidjan"} · TablièreCI` : undefined);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [selSlot,   setSelSlot]   = useState(null);
  const [pers,      setPers]      = useState(2);
  const [date,      setDate]      = useState("Aujourd'hui");
  const [step,      setStep]      = useState(1);
  const [booking,   setBooking]   = useState(false);
  const [error,     setError]     = useState("");
  const [special,   setSpecial]   = useState("");
  const [resaRef,   setResaRef]   = useState(null);

  useEffect(() => {
    restaurantsService.getBySlug(slug)
      .then(d => setResto(d.restaurant || d))
      .catch(() => setResto(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const openModal = (slot) => {
    setSelSlot(slot); setModal(true); setStep(1);
    setError(""); setSpecial(""); setResaRef(null);
  };
  const closeModal = () => { setModal(false); setStep(1); setError(""); };

  const handleBook = async () => {
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      if (!user) { navigate("/connexion?redirect=" + encodeURIComponent(window.location.pathname)); return; }
      setBooking(true); setError("");
      try {
        const reserved_at = toDatetime(date, selSlot);
        const dateOnly    = reserved_at.split("T")[0];
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

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px",
        display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "start" }}>

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

          {/* Price */}
          {resto.price_range && (
            <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 12,
              padding: "14px 18px", marginBottom: 22, display: "inline-flex",
              alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: MUTED }}>Prix moyen / personne</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: P }}>{resto.price_range}</span>
            </div>
          )}

          {/* Time slots */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: DARK,
              marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarCheck size={15} color={P} /> Créneaux disponibles
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TIME_SLOTS.map((s, i) => (
                <motion.button key={i} whileTap={{ scale: 0.95 }}
                  onClick={() => openModal(s)}
                  style={{ fontSize: 13, fontWeight: 500, padding: "8px 14px",
                    borderRadius: 8, border: `0.5px solid ${P}66`,
                    background: PL, color: DARK, cursor: "pointer", fontFamily: FONT }}>
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 14,
          padding: "22px", boxShadow: "0 2px 16px rgba(30,46,40,.06)",
          position: "sticky", top: 70 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 18 }}>
            Faire une réservation
          </div>

          {/* Date */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, color: MUTED, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Date
            </label>
            <div style={{ border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px",
              display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={13} color={MUTED} />
              <select value={date} onChange={e => setDate(e.target.value)}
                style={{ border: "none", background: "transparent", fontSize: 13,
                  color: DARK, outline: "none", flex: 1, fontFamily: FONT }}>
                <option>Aujourd'hui</option>
                <option>Demain</option>
                <option>Ce weekend</option>
              </select>
            </div>
          </div>

          {/* Personnes */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, color: MUTED, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Personnes
            </label>
            <div style={{ border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "9px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Users size={13} color={MUTED} />
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={() => setPers(p => Math.max(1, p - 1))}
                  style={{ width: 24, height: 24, borderRadius: "50%",
                    border: `1px solid ${BORDER}`, background: "white",
                    color: DARK, cursor: "pointer", fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: 14, fontWeight: 700, color: DARK, minWidth: 20, textAlign: "center" }}>
                  {pers}
                </span>
                <button onClick={() => setPers(p => Math.min(12, p + 1))}
                  style={{ width: 24, height: 24, borderRadius: "50%",
                    border: "none", background: P, color: "white",
                    cursor: "pointer", fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>
          </div>

          {/* Créneaux */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 10, color: MUTED, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 8 }}>
              Créneau
            </label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {TIME_SLOTS.map((s, i) => (
                <button key={i} onClick={() => setSelSlot(s)}
                  style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px",
                    borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                    border: `0.5px solid ${selSlot === s ? P : BORDER}`,
                    background: selSlot === s ? PL : "white",
                    color: selSlot === s ? "#C47D1A" : MUTED }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => selSlot && openModal(selSlot)}
            style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
              background: selSlot ? P : BORDER, color: "white", fontSize: 14, fontWeight: 700,
              cursor: selSlot ? "pointer" : "not-allowed", fontFamily: FONT }}>
            {selSlot ? `Réserver — ${selSlot}` : "Choisir un créneau"}
          </motion.button>

          <p style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
            Confirmation immédiate · Annulation gratuite 24h avant
          </p>
        </div>
      </div>

      {/* Modal réservation */}
      <AnimatePresence>
        {modal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal}
              style={{ position: "fixed", inset: 0, background: "rgba(30,46,40,.4)", zIndex: 50 }} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 360, damping: 32 }}
              style={{ position: "fixed", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                background: "white", borderRadius: 16, padding: "32px",
                zIndex: 51, width: 420, maxWidth: "calc(100vw - 32px)",
                boxShadow: "0 12px 48px rgba(0,0,0,.2)", fontFamily: FONT }}>

              <button onClick={closeModal}
                style={{ position: "absolute", top: 16, right: 16, background: "transparent",
                  border: "none", cursor: "pointer", color: MUTED }}>
                <X size={18} />
              </button>

              {/* Étape 3 — Succès */}
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
                    <div style={{ fontSize: 12, color: MUTED, fontFamily: "monospace",
                      marginBottom: 8 }}>Réf. {resaRef}</div>
                  )}
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, marginBottom: 26 }}>
                    <strong style={{ color: DARK }}>{resto.name}</strong><br />
                    {date} · {selSlot} · {pers} personne{pers > 1 ? "s" : ""}
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
                /* Étape 2 — Résumé + confirmation */
                <>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: DARK, marginBottom: 20 }}>
                    Confirmer la réservation
                  </h3>
                  <div style={{ background: BG, borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
                    {[
                      ["Restaurant", resto.name],
                      ["Date",       date],
                      ["Heure",      selSlot],
                      ["Personnes",  `${pers} personne${pers > 1 ? "s" : ""}`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between",
                        padding: "7px 0", borderBottom: `0.5px solid ${BORDER}`, fontSize: 13 }}>
                        <span style={{ color: MUTED }}>{k}</span>
                        <span style={{ fontWeight: 600, color: DARK }}>{v}</span>
                      </div>
                    ))}
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
                /* Étape 1 — Choix créneau */
                <>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: DARK, marginBottom: 4 }}>
                    Réserver une table
                  </h3>
                  <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{resto.name}</p>

                  {/* Résumé sélection */}
                  <div style={{ background: PL, borderRadius: 10, padding: "12px 16px",
                    marginBottom: 20, display: "flex", gap: 16, fontSize: 13,
                    alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: P }}>{selSlot}</span>
                    <span style={{ color: DARK }}>{date}</span>
                    <span style={{ color: MUTED }}>{pers} pers.</span>
                  </div>

                  {/* Modifier créneau */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 10, color: MUTED, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                      Changer de créneau
                    </div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {TIME_SLOTS.map((s, i) => (
                        <button key={i} onClick={() => setSelSlot(s)}
                          style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px",
                            borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                            border: `0.5px solid ${selSlot === s ? P : BORDER}`,
                            background: selSlot === s ? PL : "white",
                            color: selSlot === s ? "#C47D1A" : MUTED }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: MUTED, marginBottom: 20, lineHeight: 1.5 }}>
                    Annulation gratuite jusqu'à 24h avant la réservation. Aucun paiement requis.
                  </p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleBook}
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
