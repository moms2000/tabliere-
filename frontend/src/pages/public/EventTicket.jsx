import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Calendar, MapPin, Clock, Download, Ticket } from "lucide-react";
import { eventReservationsService } from "../../services/events.service.js";

const P = "#E8A045", DARK = "#1E2E28", BG = "#F8F5EF", BORDER = "#E4DFD8", MUTED = "#9BA89F", GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const fmtDate = (d) => d ? new Date(d).toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

export default function EventTicket() {
  const { ref } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    eventReservationsService.getTicket(ref)
      .then(setData).catch(() => setErr(true)).finally(() => setLoading(false));
  }, [ref]);

  // Télécharge le QR en PNG (rasterise le SVG)
  const download = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 600; c.height = 600;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 600, 600);
      ctx.drawImage(img, 40, 40, 520, 520);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png"); a.download = `billet-${data.ref}.png`; a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  };

  const Center = ({ children }) => (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: MUTED }}>{children}</div>
  );

  if (loading) return <Center>Chargement…</Center>;
  if (err || !data) return <Center><Ticket size={34} color={BORDER} /><div style={{ marginTop: 10 }}>Billet introuvable.</div></Center>;

  if (!data.confirmed) return (
    <Center>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FEF6EC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Clock size={28} color={P} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: DARK }}>Réservation en attente d'acompte</div>
      <div style={{ fontSize: 13.5, color: "#4a5a52", maxWidth: 320, marginTop: 8, lineHeight: 1.55 }}>
        Votre réservation <strong>{data.ref}</strong>{data.event_name ? ` pour « ${data.event_name} »` : ""} n'est pas encore confirmée.
        Votre <strong>QR code apparaîtra ici</strong> dès que l'organisateur aura validé la réception de votre acompte.
      </div>
    </Center>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, padding: "40px 20px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,.08)" }}>
          <div style={{ background: DARK, padding: "18px 22px", color: "white" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1D9E7533", color: "#8FE3C4", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN }} /> Confirmée
            </div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{data.event_name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 2 }}>Billet {data.ref}</div>
          </div>

          <div style={{ padding: 24, textAlign: "center" }}>
            <div ref={qrRef} style={{ display: "inline-block", padding: 14, background: "white", border: `0.5px solid ${BORDER}`, borderRadius: 14 }}>
              <QRCode value={data.qr} size={196} fgColor={DARK} />
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>Présentez ce QR code à l'entrée pour le check-in.</div>
            <button onClick={download} style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, border: "none",
              background: P, color: "#1A1000", borderRadius: 11, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
              <Download size={16} /> Télécharger mon billet
            </button>
          </div>

          <div style={{ padding: "16px 22px", borderTop: `1px dashed ${BORDER}`, display: "grid", gap: 8 }}>
            <Row icon={Calendar} text={fmtDate(data.starts_at)} />
            {(data.venue_name || data.address || data.ville) && (
              <Row icon={MapPin} text={[data.venue_name, data.ville].filter(Boolean).join(", ") || data.address} />
            )}
            <Row icon={Ticket} text={`${data.table_kind === "vip" ? "VIP · " : ""}${data.table_label || "Entrée"} · ${data.party_size} pers. · ${data.name || ""}`} />
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 14 }}>TablièreCI — tabliereci.net</div>
      </div>
    </div>
  );
}

const Row = ({ icon: Icon, text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3a4a42" }}>
    <Icon size={14} color={MUTED} /> <span>{text}</span>
  </div>
);
