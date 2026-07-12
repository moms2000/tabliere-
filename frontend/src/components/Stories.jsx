import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, X, Trash2, Flag, ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { storiesService } from "../services/stories.service.js";
import { compressImage } from "../services/upload.js";
import api from "../services/api.js";

const AMBER = "#E8A045";
const DARK = "#1E2E28";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";
const REACTIONS = ["❤️", "🔥", "😍", "👏", "😮"];

const timeLeft = (expires) => {
  const ms = new Date(expires) - Date.now();
  if (ms <= 0) return "expiré";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h` : `${m} min`;
};

export default function Stories({ slug }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [data, setData] = useState(null);      // { stories, can_post, remaining, enabled }
  const [openIdx, setOpenIdx] = useState(null);  // index dans stories[] ou null
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    if (!user || !slug) return;
    storiesService.list(slug).then(setData).catch(() => setData({ stories: [], can_post: false, enabled: true }));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, slug]);

  // ── Non connecté : teaser compact (bulles floues = photos masquées) ──
  if (!user) {
    const BUBBLES = ["#E8A045", "#3D6B55", "#E86A45", "#8A5AE8"];
    return (
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 16px" }}>
        <div onClick={() => navigate("/connexion")}
          style={{ borderRadius: 14, cursor: "pointer",
            background: "linear-gradient(120deg, #ffffff 0%, #FEF6EC 100%)",
            border: "0.5px solid #E4DFD8", padding: "10px 12px",
            display: "flex", alignItems: "center", gap: 10, fontFamily: FONT }}>
          {/* Bulles floues — évoquent des photos masquées */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {BUBBLES.map((c, i) => (
              <div key={i} style={{ width: 34, height: 34, borderRadius: "50%", marginLeft: i ? -11 : 0,
                background: `radial-gradient(circle at 32% 28%, ${c}, ${c}66)`,
                filter: "blur(2px)", border: "2px solid #fff",
                boxShadow: "0 1px 6px rgba(0,0,0,.10)" }} />
            ))}
            <div style={{ width: 34, height: 34, borderRadius: "50%", marginLeft: -11, zIndex: 1,
              background: AMBER, border: "2px solid #fff", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#1a1000", flexShrink: 0 }}>
              <Camera size={15} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Instants du restaurant</div>
            <div style={{ fontSize: 11.5, color: "#8A7F70",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Connectez-vous pour voir les photos des clients
            </div>
          </div>
          <ChevronRight size={18} color={AMBER} style={{ flexShrink: 0 }} />
        </div>
      </div>
    );
  }

  if (!data || data.enabled === false) return null;
  const stories = data.stories || [];
  if (!stories.length && !data.can_post) return null; // rien à montrer

  const pickPhoto = () => fileRef.current?.click();
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPosting(true); setErr("");
    try {
      const dataUri = await compressImage(file, 1200, 0.82);
      await storiesService.create(slug, dataUri);
      load();
    } catch (e2) {
      setErr(e2.response?.data?.message || "Échec du partage");
    } finally { setPosting(false); }
  };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px", fontFamily: FONT }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: DARK, marginBottom: 12 }}>Instants</div>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
        {/* Bouton partager */}
        {data.can_post && (
          <div onClick={posting ? undefined : pickPhoto}
            style={{ flexShrink: 0, width: 72, textAlign: "center", cursor: posting ? "default" : "pointer" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", border: `2px dashed ${AMBER}`,
              display: "flex", alignItems: "center", justifyContent: "center", background: AMBER + "12" }}>
              {posting ? <span style={{ fontSize: 11, color: AMBER }}>…</span> : <Plus size={26} color={AMBER} />}
            </div>
            <div style={{ fontSize: 11, color: DARK, marginTop: 6, fontWeight: 600 }}>Partager</div>
          </div>
        )}
        {/* Vignettes */}
        {stories.map((s, i) => (
          <div key={s.id} onClick={() => setOpenIdx(i)}
            style={{ flexShrink: 0, width: 72, textAlign: "center", cursor: "pointer" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", padding: 3,
              background: `linear-gradient(135deg, ${AMBER}, #D4842B)` }}>
              <img src={s.photo_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%",
                objectFit: "cover", border: "2px solid #fff" }} />
            </div>
            <div style={{ fontSize: 11, color: "#6b665d", marginTop: 6, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {(s.author_name || "Client").split(" ")[0]}
            </div>
          </div>
        ))}
      </div>
      {err && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{err}</div>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />

      {openIdx !== null && stories[openIdx] && (
        <StoryViewer
          stories={stories} index={openIdx} onIndex={setOpenIdx}
          onClose={() => setOpenIdx(null)} onChanged={load} userId={user.id}
        />
      )}
    </div>
  );
}

// ── Visionneuse plein écran ──────────────────────────────────────────────────
function StoryViewer({ stories, index, onIndex, onClose, onChanged, userId }) {
  const s = stories[index];
  const [reaction, setReaction] = useState(s.my_reaction || null);
  const [reactCount, setReactCount] = useState(s.reactions || 0);
  const [reported, setReported] = useState(false);

  useEffect(() => { setReaction(s.my_reaction || null); setReactCount(s.reactions || 0); setReported(false); }, [index]);

  const react = async (emoji) => {
    const was = reaction;
    if (was === emoji) { setReaction(null); setReactCount(c => Math.max(0, c - 1)); storiesService.unreact(s.id).catch(() => {}); }
    else { setReaction(emoji); setReactCount(c => was ? c : c + 1); storiesService.react(s.id, emoji).catch(() => {}); }
  };
  const del = async () => {
    if (!confirm("Supprimer cet Instant ?")) return;
    await storiesService.remove(s.id).catch(() => {});
    onChanged(); onClose();
  };
  const report = () => { setReported(true); api.post("/reports", { type: "story", target_id: s.id }).catch(() => {}); };
  const prev = () => index > 0 && onIndex(index - 1);
  const next = () => index < stories.length - 1 ? onIndex(index + 1) : onClose();

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      {/* Zones de navigation (tap) */}
      <div onClick={prev} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", zIndex: 2 }} />
      <div onClick={next} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "30%", zIndex: 2 }} />

      <img src={s.photo_url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />

      {/* Header */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 14px)", left: 16, right: 16,
        display: "flex", alignItems: "center", gap: 10, zIndex: 3 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
          background: AMBER, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1000", fontWeight: 800 }}>
          {s.author_avatar ? <img src={s.author_avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (s.author_name || "C").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
            {(s.author_name || "Client").split(" ")[0]}
            <span style={{ fontSize: 10, fontWeight: 700, color: "#1a1000", background: "#fff",
              borderRadius: 8, padding: "2px 6px" }}>✓ Client vérifié</span>
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.7)" }}>Disparaît dans {timeLeft(s.expires_at)}</div>
        </div>
        <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,.2)", borderRadius: "50%",
          width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={18} color="#fff" />
        </button>
      </div>

      {/* Flèches desktop */}
      {index > 0 && (
        <button onClick={prev} style={{ position: "absolute", left: 12, zIndex: 4, border: "none",
          background: "rgba(255,255,255,.15)", borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={22} color="#fff" /></button>
      )}
      {index < stories.length - 1 && (
        <button onClick={next} style={{ position: "absolute", right: 12, zIndex: 4, border: "none",
          background: "rgba(255,255,255,.15)", borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={22} color="#fff" /></button>
      )}

      {/* Footer : réactions + actions */}
      <div style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom,0px) + 18px)", left: 16, right: 16,
        zIndex: 3, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, background: "rgba(0,0,0,.35)", borderRadius: 30, padding: "8px 14px" }}>
          {REACTIONS.map(e => (
            <button key={e} onClick={() => react(e)}
              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 26,
                transform: reaction === e ? "scale(1.3)" : "scale(1)", transition: "transform .15s", opacity: reaction && reaction !== e ? 0.5 : 1 }}>
              {e}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "rgba(255,255,255,.85)", fontSize: 13 }}>
          <span>{reactCount} réaction{reactCount > 1 ? "s" : ""}</span>
          {s.is_mine ? (
            <button onClick={del} style={{ display: "flex", alignItems: "center", gap: 5, border: "none",
              background: "transparent", color: "rgba(255,255,255,.85)", cursor: "pointer", fontSize: 13 }}>
              <Trash2 size={14} /> Supprimer
            </button>
          ) : reported ? (
            <span style={{ color: "rgba(255,255,255,.6)" }}>✓ Signalé</span>
          ) : (
            <button onClick={report} style={{ display: "flex", alignItems: "center", gap: 5, border: "none",
              background: "transparent", color: "rgba(255,255,255,.85)", cursor: "pointer", fontSize: 13 }}>
              <Flag size={14} /> Signaler
            </button>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
