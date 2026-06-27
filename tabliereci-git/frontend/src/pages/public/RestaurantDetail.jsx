import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, MapPin, Clock, Users, Calendar,
  UtensilsCrossed, Wifi, Music, CheckCircle, X,
} from "lucide-react";

const G    = "#1D9E75";
const DARK = "#0F6E56";

const RESTAURANTS = {
  1: {
    name: "Le Maquis du Plateau",
    rating: 4.8, reviews: 213,
    cuisine: "Cuisine ivoirienne",
    quartier: "Plateau, Abidjan",
    desc: "L'adresse incontournable du Plateau pour déguster l'attiéké poisson braisé dans un cadre chaleureux. Terrasse ombragée, service attentionné et spécialités ivoiriennes revisitées avec talent.",
    tags: ["Terrasse", "Halal", "Wifi", "Climatisé"],
    slots: ["19h00","19h30","20h00","21h00","21h30"],
    photos: ["#E1F5EE","#C8EFE0","#A8E0C8"],
    price: "5 000 – 15 000 F",
    hours: "Lun–Dim · 12h00–23h00",
  },
  2: {
    name: "La Terrasse d'Abidjan",
    rating: 4.5, reviews: 98,
    cuisine: "Française · Grillades",
    quartier: "Cocody, Abidjan",
    desc: "Vue imprenable sur la lagune Ébrié, cuisine française revisitée aux saveurs africaines. Le vendredi soir, un groupe de jazz live anime le dîner.",
    tags: ["Vue lagune", "Live jazz", "Terrasse", "Privatisable"],
    slots: ["20h00","20h30","22h00"],
    photos: ["#FAEEDA","#F5DCC0","#EEC89A"],
    price: "12 000 – 35 000 F",
    hours: "Mar–Dim · 12h00–00h00",
  },
  3: {
    name: "Saveurs de Cocody",
    rating: 4.9, reviews: 47,
    cuisine: "Gastronomique",
    quartier: "Cocody, Abidjan",
    desc: "Restaurant gastronomique proposant un menu dégustation en 5 services autour des produits locaux ivoiriens. Cadre intimiste, cave à vins sélectionnée.",
    tags: ["Gastronomique", "Menu dégustation", "Cave à vins", "Intimiste"],
    slots: ["19h00","19h30","21h00"],
    photos: ["#E6F1FB","#C8DEF5","#A8C8EF"],
    price: "35 000 – 80 000 F",
    hours: "Mer–Dim · 19h00–23h00",
  },
};

export default function RestaurantDetail() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const resto       = RESTAURANTS[id] || RESTAURANTS[1];

  const [modal,    setModal]    = useState(false);
  const [selSlot,  setSelSlot]  = useState(null);
  const [pers,     setPers]     = useState(2);
  const [date,     setDate]     = useState("Aujourd'hui");
  const [step,     setStep]     = useState(1); // 1=créneau 2=confirm 3=succès

  const book = () => {
    if (step === 1 && selSlot) setStep(2);
    else if (step === 2) setStep(3);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", fontFamily: "Inter, sans-serif" }}>

      {/* Nav */}
      <nav style={{ background: "white", borderBottom: "0.5px solid #eee",
        padding: "14px 28px", display: "flex", alignItems: "center", gap: 14,
        position: "sticky", top: 0, zIndex: 20 }}>
        <button onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: "none", cursor: "pointer", fontSize: 13, color: "#666" }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <span style={{ color: "#ddd" }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{resto.name}</span>
      </nav>

      {/* Photos */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr",
        gap: 4, height: 260, overflow: "hidden" }}>
        {resto.photos.map((c, i) => (
          <div key={i} style={{ background: c, display: "flex",
            alignItems: "center", justifyContent: "center",
            gridRow: i === 0 ? "1 / 3" : "auto", minHeight: 120 }}>
            <UtensilsCrossed size={i === 0 ? 52 : 30} color={DARK} style={{ opacity: 0.3 }} />
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px",
        display: "grid", gridTemplateColumns: "1fr 320px", gap: 28 }}>

        {/* Infos */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", marginBottom: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>{resto.name}</h1>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={14}
                  fill={i <= Math.round(resto.rating) ? "#EF9F27" : "none"}
                  color={i <= Math.round(resto.rating) ? "#EF9F27" : "#ddd"} />
              ))}
              <span style={{ fontSize: 13, color: "#888", marginLeft: 4 }}>
                {resto.rating} ({resto.reviews} avis)
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, color: "#888", fontSize: 13,
            marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MapPin size={14} />{resto.quartier}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <UtensilsCrossed size={14} />{resto.cuisine}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={14} />{resto.hours}
            </span>
          </div>

          <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, marginBottom: 20 }}>
            {resto.desc}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {resto.tags.map((t, i) => (
              <span key={i} style={{ fontSize: 12, background: "#E1F5EE", color: DARK,
                padding: "4px 12px", borderRadius: 20, fontWeight: 500 }}>{t}</span>
            ))}
          </div>

          {/* Prix */}
          <div style={{ background: "white", border: "0.5px solid #eee",
            borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>Prix moyen par personne</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: G }}>{resto.price}</div>
          </div>

          {/* Créneaux disponibles */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Créneaux disponibles ce soir
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {resto.slots.map((s, i) => (
                <motion.button key={i} whileTap={{ scale: 0.95 }}
                  onClick={() => { setSelSlot(s); setModal(true); setStep(1); }}
                  style={{ fontSize: 13, fontWeight: 500, padding: "8px 16px",
                    borderRadius: 8, border: `0.5px solid ${G}55`,
                    background: "#E1F5EE", color: DARK, cursor: "pointer" }}>
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar réservation */}
        <div style={{ background: "white", border: "0.5px solid #eee",
          borderRadius: 14, padding: "20px", height: "fit-content",
          boxShadow: "0 2px 12px rgba(0,0,0,.05)", position: "sticky", top: 70 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            Faire une réservation
          </div>

          {/* Date */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 500,
              textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>
              Date
            </label>
            <div style={{ border: "0.5px solid #eee", borderRadius: 9, padding: "9px 12px",
              display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <Calendar size={14} color="#bbb" />
              <select value={date} onChange={e => setDate(e.target.value)}
                style={{ border: "none", background: "transparent", fontSize: 13,
                  color: "#333", outline: "none", flex: 1, cursor: "pointer" }}>
                <option>Aujourd'hui</option>
                <option>Demain</option>
                <option>Ce weekend</option>
              </select>
            </div>
          </div>

          {/* Personnes */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 500,
              textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>
              Personnes
            </label>
            <div style={{ border: "0.5px solid #eee", borderRadius: 9, padding: "9px 12px",
              display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={14} color="#bbb" />
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <button onClick={() => setPers(p => Math.max(1, p - 1))}
                  style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${G}`,
                    background: "white", color: G, cursor: "pointer", fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{pers}</span>
                <button onClick={() => setPers(p => Math.min(12, p + 1))}
                  style={{ width: 24, height: 24, borderRadius: "50%", border: "none",
                    background: G, color: "white", cursor: "pointer", fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>
          </div>

          {/* Créneaux */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 500,
              textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>
              Choisir un créneau
            </label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {resto.slots.map((s, i) => (
                <button key={i} onClick={() => setSelSlot(s)}
                  style={{ fontSize: 13, fontWeight: 500, padding: "7px 13px",
                    borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${selSlot === s ? G : "#eee"}`,
                    background: selSlot === s ? "#E1F5EE" : "white",
                    color: selSlot === s ? DARK : "#444" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => selSlot && setModal(true)}
            style={{ width: "100%", padding: "13px 0", borderRadius: 10,
              border: "none", background: selSlot ? G : "#ddd",
              color: "white", fontSize: 14, fontWeight: 600,
              cursor: selSlot ? "pointer" : "not-allowed" }}>
            {selSlot ? `Réserver — ${selSlot}` : "Choisir un créneau"}
          </motion.button>

          <p style={{ textAlign: "center", fontSize: 11, color: "#bbb", marginTop: 10 }}>
            Confirmation immédiate · Annulation gratuite 24h avant
          </p>
        </div>
      </div>

      {/* Modal réservation */}
      <AnimatePresence>
        {modal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setModal(false); setStep(1); }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 50 }} />
            <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ position: "fixed", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)", background: "white", borderRadius: 16,
                padding: "32px 36px", zIndex: 51, width: 380,
                boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>

              <button onClick={() => { setModal(false); setStep(1); }}
                style={{ position: "absolute", top: 16, right: 16, background: "transparent",
                  border: "none", cursor: "pointer" }}>
                <X size={18} color="#888" />
              </button>

              {step === 3 ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#E1F5EE",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px" }}>
                    <CheckCircle size={28} color={G} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Réservation confirmée !</h3>
                  <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 8 }}>
                    <strong>{resto.name}</strong><br />
                    {date} · {selSlot} · {pers} personne{pers > 1 ? "s" : ""}
                  </p>
                  <p style={{ fontSize: 12, color: "#aaa", marginBottom: 24 }}>
                    Confirmation envoyée sur WhatsApp
                  </p>
                  <button onClick={() => { setModal(false); setStep(1); navigate("/"); }}
                    style={{ background: G, color: "white", border: "none", borderRadius: 9,
                      padding: "11px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Retour à l'accueil
                  </button>
                </div>
              ) : step === 2 ? (
                <>
                  <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20 }}>Confirmer la réservation</h3>
                  {[
                    ["Restaurant", resto.name],
                    ["Date", date],
                    ["Heure", selSlot],
                    ["Personnes", `${pers} personne${pers > 1 ? "s" : ""}`],
                    ["Paiement", "À la caisse"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between",
                      padding: "8px 0", borderBottom: "0.5px solid #f8f8f8", fontSize: 13 }}>
                      <span style={{ color: "#888" }}>{k}</span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                  <motion.button whileTap={{ scale: 0.97 }} onClick={book}
                    style={{ width: "100%", marginTop: 20, padding: "13px 0", borderRadius: 10,
                      border: "none", background: G, color: "white",
                      fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Confirmer la réservation
                  </motion.button>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
                    Réserver une table
                  </h3>
                  <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>{resto.name}</p>
                  <div style={{ background: "#E1F5EE", borderRadius: 10, padding: "12px 16px",
                    marginBottom: 20, display: "flex", gap: 16, fontSize: 13 }}>
                    <span><strong>{selSlot}</strong> · {date}</span>
                    <span>{pers} pers.</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#aaa", marginBottom: 20, lineHeight: 1.5 }}>
                    En continuant, vous acceptez nos conditions d'annulation.<br />
                    Annulation gratuite jusqu'à 24h avant.
                  </p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={book}
                    style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
                      background: G, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
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
