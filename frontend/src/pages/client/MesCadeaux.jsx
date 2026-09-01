import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Gift, ArrowLeft, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { promotionsService } from "../../services/promotions.service.js";

const P = "#E8A045"; const PL = "#FEF6EC"; const DARK = "#1E2E28"; const BG = "#F8F5EF";
const BORDER = "#E4DFD8"; const MUTED = "#9BA89F"; const GREEN = "#1D9E75";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

const fmt = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

export default function MesCadeaux() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    promotionsService.mine()
      .then(d => setVouchers(d?.vouchers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <button onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer",
            color: MUTED, fontSize: 13, marginBottom: 18, padding: 0, fontFamily: FONT }}>
          <ArrowLeft size={14} /> Retour
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Gift size={24} color={P} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>Mes cadeaux</h1>
        </div>
        <p style={{ fontSize: 14, color: MUTED, margin: "0 0 20px" }}>
          Présentez le code au restaurant pour profiter de votre récompense.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: MUTED }}>Chargement…</div>
        ) : vouchers.length === 0 ? (
          <div style={{ textAlign: "center", padding: 50, color: MUTED, background: "white", borderRadius: 16, border: `1px solid ${BORDER}` }}>
            <Gift size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 15, color: DARK, fontWeight: 600 }}>Pas encore de cadeau</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Participez aux jeux TablièreCI pour tenter votre chance !</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {vouchers.map((v, i) => {
              const used = v.status === "used";
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  style={{ background: "white", borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden",
                    opacity: used ? 0.75 : 1 }}>
                  <div style={{ background: used ? "#EEF3F0" : DARK, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Sparkles size={16} color={used ? GREEN : P} />
                      <span style={{ color: used ? DARK : "#EAE0CC", fontWeight: 700, fontSize: 14 }}>{v.reward_label}</span>
                    </div>
                    {used
                      ? <span style={{ display: "flex", alignItems: "center", gap: 4, color: GREEN, fontSize: 12, fontWeight: 700 }}><CheckCircle2 size={14} /> Utilisé</span>
                      : <span style={{ color: "rgba(234,224,204,.6)", fontSize: 12 }}>{v.restaurant_name}</span>}
                  </div>
                  <div style={{ padding: "18px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
                      {used ? "Code utilisé" : "Votre code à présenter"}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "3px", color: used ? MUTED : P,
                      fontFamily: "monospace", textDecoration: used ? "line-through" : "none" }}>
                      {v.code}
                    </div>
                    {!used && (
                      <div style={{ marginTop: 12, fontSize: 12.5, color: MUTED, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <span>{v.restaurant_name}</span>
                        {v.expires_at && <><span>·</span><Clock size={12} /> <span>valable jusqu'au {fmt(v.expires_at)}</span></>}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
