import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import { Calendar, MapPin, ArrowLeft, Crown, Armchair, Users, Check, PartyPopper } from "lucide-react";
import { eventsService, eventReservationsService } from "../../services/events.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmt = (n) => n ? Number(n).toLocaleString("fr-FR") + " F" : "Gratuit";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default function EventDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [picked, setPicked] = useState(null);      // table object being reserved (or {free:true})
  const [party, setParty] = useState(2);
  const [note, setNote] = useState("");
  const [promo, setPromo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);          // reservation ref after success

  const load = () =>
    eventsService.getBySlug(slug)
      .then(d => { setEvent(d.event); setTables(d.tables || []); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  if (loading) return <Center>Chargement…</Center>;
  if (notFound || !event) return <Center><PartyPopper size={34} color={BORDER} /><div style={{ marginTop: 10 }}>Événement introuvable ou non publié.</div><button onClick={() => navigate("/")} style={linkBtn}>Retour à l'accueil</button></Center>;

  const vip = tables.filter(t => t.kind === "vip");
  const simple = tables.filter(t => t.kind !== "vip");

  const reserve = async () => {
    if (!user) { navigate("/connexion", { state: { from: `/evenement/${slug}` } }); return; }
    setSubmitting(true);
    try {
      const { reservation } = await eventReservationsService.create({
        slug, table_id: picked?.id || undefined, party_size: party, special_request: note || undefined,
        promoter_code: promo || undefined,
      });
      setDone(reservation.ref); setPicked(null); load();
    } catch (e) { alert(e.response?.data?.message || "Erreur lors de la réservation"); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT }}>
      {/* Cover */}
      <div style={{ height: 220, position: "relative",
        background: event.cover_url ? `url(${event.cover_url}) center/cover` : `linear-gradient(135deg, ${DARK}, #2c4438)` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.65), rgba(0,0,0,.1))" }} />
        <button onClick={() => navigate(-1)}
          style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 14px)", left: 16, zIndex: 2,
            border: "none", background: "rgba(0,0,0,.4)", borderRadius: "50%", width: 38, height: 38,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ArrowLeft size={19} color="white" />
        </button>
        <div style={{ position: "absolute", bottom: 16, left: 20, right: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "white", margin: 0, lineHeight: 1.15 }}>{event.name}</h1>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 16px 60px" }}>
        {/* Infos */}
        <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
          <Info icon={Calendar} text={fmtDate(event.starts_at)} />
          {(event.venue_name || event.address || event.ville) && (
            <Info icon={MapPin} text={[event.venue_name, event.quartier, event.ville].filter(Boolean).join(", ") || event.address} />
          )}
          {event.organizer_name && <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Organisé par {event.organizer_name}</div>}
          {event.description && <p style={{ fontSize: 13.5, color: "#4a5a52", lineHeight: 1.6, marginTop: 12, marginBottom: 0, whiteSpace: "pre-wrap" }}>{event.description}</p>}
        </div>

        {/* Galerie photos */}
        {Array.isArray(event.photos) && event.photos.length > 1 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
            {event.photos.map((url, i) => (
              <img key={i} src={url} alt="" style={{ height: 130, borderRadius: 12, flexShrink: 0, objectFit: "cover" }} />
            ))}
          </div>
        )}

        {done && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#F0F6F2", border: `0.5px solid ${GREEN}55`, borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: GREEN, fontWeight: 700, fontSize: 14 }}>
              <Check size={18} /> Demande envoyée !
            </div>
            <div style={{ fontSize: 13, color: "#3a5a4a", marginTop: 6 }}>
              Votre réservation <strong>{done}</strong> est en attente de confirmation de l'organisateur. Paiement en cash sur place.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, background: "white", borderRadius: 10, padding: 12 }}>
              <div style={{ background: "white", padding: 6, borderRadius: 8, border: `0.5px solid ${BORDER}` }}>
                <QRCode value={done} size={72} fgColor={DARK} />
              </div>
              <div style={{ fontSize: 12.5, color: MUTED }}>
                Présentez ce QR à l'entrée pour votre <strong style={{ color: DARK }}>check-in</strong>.
              </div>
            </div>
          </motion.div>
        )}

        {/* Tables / VIP */}
        <div style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 10 }}>Réserver une table</div>
        {tables.length === 0 ? (
          <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 14, padding: "28px 18px",
            textAlign: "center", color: MUTED, fontSize: 13 }}>
            L'organisateur n'a pas encore ouvert de tables à la réservation.
          </div>
        ) : (
          <>
            {vip.length > 0 && <Group title="Packs VIP" icon={Crown} items={vip} onPick={setPicked} />}
            {simple.length > 0 && <Group title="Tables" icon={Armchair} items={simple} onPick={setPicked} />}
          </>
        )}
      </div>

      {/* Modal réservation */}
      {picked && (
        <div onPointerDown={() => !submitting && setPicked(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 999,
            display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: FONT }}>
          <motion.div initial={{ y: 40 }} animate={{ y: 0 }} onPointerDown={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, padding: "20px 20px calc(env(safe-area-inset-bottom,0px) + 20px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {picked.kind === "vip" ? <Crown size={18} color={P} /> : <Armchair size={18} color={DARK} />}
              <span style={{ fontSize: 17, fontWeight: 700, color: DARK }}>{picked.label}</span>
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>
              {picked.capacity} pers. · {fmt(picked.price)}{picked.kind === "vip" ? " · pack VIP" : ""}
            </div>
            {picked.description && <div style={{ fontSize: 12.5, color: "#4a5a52", marginBottom: 12 }}>{picked.description}</div>}

            <label style={lbl}>Nombre de personnes</label>
            <input type="number" min={1} max={picked.capacity || 20} value={party} onChange={e => setParty(+e.target.value)} style={inp} />

            <label style={{ ...lbl, marginTop: 12 }}>Code promoteur (optionnel)</label>
            <input value={promo} onChange={e => setPromo(e.target.value.toUpperCase())} placeholder="Ex : KOFFI"
              style={{ ...inp, letterSpacing: 1, fontWeight: 600 }} />

            <label style={{ ...lbl, marginTop: 12 }}>Message (optionnel)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Occasion, arrivée prévue…"
              style={{ ...inp, resize: "vertical" }} />

            <div style={{ fontSize: 11.5, color: MUTED, margin: "12px 0", background: BG, borderRadius: 8, padding: "9px 12px" }}>
              Paiement en <strong>cash sur place</strong>. Votre demande sera confirmée par l'organisateur.
            </div>

            <button onClick={reserve} disabled={submitting}
              style={{ width: "100%", border: "none", borderRadius: 11, padding: "14px 0", background: P,
                color: "#1A1000", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
              {submitting ? "Envoi…" : user ? "Confirmer la réservation" : "Se connecter pour réserver"}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Group({ title, icon: Icon, items, onPick }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Icon size={15} color={P} /><span style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{title}</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map(t => {
          const taken = t.status !== "libre";
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white",
              border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", opacity: taken ? 0.55 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{t.label}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
                  <Users size={12} /> {t.capacity} pers. · {fmt(t.price)}
                </div>
                {t.description && <div style={{ fontSize: 11.5, color: "#4a5a52", marginTop: 4, whiteSpace: "pre-wrap" }}>{t.description}</div>}
                {t.min_order > 0 && (
                  <div style={{ fontSize: 11.5, color: "#C47D1A", marginTop: 3, fontWeight: 600 }}>
                    Minimum de commande : {fmt(t.min_order)}
                  </div>
                )}
              </div>
              {taken ? (
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Réservée</span>
              ) : (
                <button onClick={() => onPick(t)}
                  style={{ border: "none", borderRadius: 9, padding: "8px 16px", background: P,
                    color: "#1A1000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  Réserver
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Info = ({ icon: Icon, text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: DARK, marginBottom: 4 }}>
    <Icon size={15} color={P} style={{ flexShrink: 0 }} /> <span>{text}</span>
  </div>
);
const Center = ({ children }) => (
  <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 14, fontFamily: FONT, padding: 24, textAlign: "center" }}>{children}</div>
);
const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#6A7A72", marginBottom: 6 };
const inp = { width: "100%", border: `0.5px solid ${BORDER}`, borderRadius: 9, padding: "11px 13px", fontSize: 14, background: BG, outline: "none", fontFamily: FONT, boxSizing: "border-box", color: DARK };
const linkBtn = { marginTop: 14, border: "none", background: "transparent", color: P, fontWeight: 600, cursor: "pointer", fontFamily: FONT, fontSize: 13 };
