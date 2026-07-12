import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageCircle, X } from "lucide-react";
import { chatService } from "../services/chat.service.js";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const G = "#1D9E75";

const fmtTime = (dt) => dt
  ? new Date(dt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  : "";

const fmtDate = (dt) => {
  if (!dt) return "";
  const d = new Date(dt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};

/**
 * Composant Chat — à placer dans n'importe quelle page
 * Props:
 *   reservationId  {string|number}
 *   otherName      {string}  — nom de l'interlocuteur
 *   onClose        {fn}      — optionnel, pour fermer en mode overlay
 */
export default function Chat({ reservationId, otherName = "Restaurant", onClose }) {
  const { user } = useAuth();

  // Modération UGC : signaler / bloquer la conversation
  const [menuOpen, setMenuOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [blocked,  setBlocked]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("tci_blocked_chats") || "[]").map(String).includes(String(reservationId)); }
    catch { return false; }
  });
  const reportChat = () => {
    setReported(true); setMenuOpen(false);
    api.post("/reports", { type: "chat", target_id: reservationId }).catch(() => {});
  };
  const toggleBlock = () => {
    setMenuOpen(false);
    setBlocked(b => {
      const nb = !b;
      try {
        const list = new Set(JSON.parse(localStorage.getItem("tci_blocked_chats") || "[]").map(String));
        nb ? list.add(String(reservationId)) : list.delete(String(reservationId));
        localStorage.setItem("tci_blocked_chats", JSON.stringify([...list]));
      } catch {}
      return nb;
    });
  };
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const bottomRef = useRef(null);
  const pollRef   = useRef(null);

  const fetchMessages = async () => {
    try {
      const msgs = await chatService.getMessages(reservationId);
      setMessages(msgs);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    if (!reservationId) return;
    fetchMessages();
    // Polling 4s — en pause quand l'onglet est masqué (économie batterie/trafic)
    const tick = () => { if (document.visibilityState === "visible") fetchMessages(); };
    pollRef.current = setInterval(tick, 4000);
    const onVis = () => { if (document.visibilityState === "visible") fetchMessages(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(pollRef.current); document.removeEventListener("visibilitychange", onVis); };
  }, [reservationId]);

  // Scroll en bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    // Optimistic update
    const optimistic = {
      id: Date.now(),
      content: text,
      sender_id: user.id,
      sender_name: user.full_name,
      sender_role: user.role,
      created_at: new Date().toISOString(),
      is_read: false,
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const msg = await chatService.sendMessage(reservationId, text);
      setMessages(prev => prev.map(m => m._optimistic && m.id === optimistic.id ? msg : m));
    } catch (_) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(text); // restore
    } finally {
      setSending(false);
    }
  };

  // Grouper les messages par date
  let lastDate = null;
  const grouped = messages.map(m => {
    const d = fmtDate(m.created_at);
    const showDate = d !== lastDate;
    lastDate = d;
    return { ...m, showDate, dateLabel: d };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "white",
      borderRadius: 14, border: "0.5px solid #eee", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "0.5px solid #f0f0f0",
        background: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#E1F5EE",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageCircle size={16} color={G} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{otherName}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                background: "#1D9E75", marginRight: 4 }} />
              En ligne
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#bbb",
              fontSize: 22, lineHeight: 1, padding: "0 6px" }}>⋮</button>
          {menuOpen && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 30,
              background: "white", border: "0.5px solid #eee", borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,.14)", overflow: "hidden", minWidth: 190 }}>
              {reported ? (
                <div style={{ padding: "11px 14px", fontSize: 12.5, color: "#1e7d4f" }}>✓ Conversation signalée</div>
              ) : (
                <button onClick={reportChat}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 14px",
                    border: "none", background: "white", cursor: "pointer", fontSize: 13, color: "#c0392b" }}>
                  Signaler la conversation
                </button>
              )}
              <button onClick={toggleBlock}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 14px",
                  border: "none", borderTop: "0.5px solid #f4f4f4", background: "white",
                  cursor: "pointer", fontSize: 13, color: "#333" }}>
                {blocked ? "Débloquer" : "Bloquer"}
              </button>
            </div>
          )}
          {onClose && (
            <button onClick={onClose}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#bbb" }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: 6, background: "#fafafa" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            flex: 1, color: "#bbb", fontSize: 13, gap: 8 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Chargement…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#bbb" }}>
            <MessageCircle size={32} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>Démarrez la conversation</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Envoyez un message pour commencer</div>
          </div>
        ) : grouped.map((m, i) => {
          const isMe = m.sender_id === user.id;
          return (
            <div key={m.id}>
              {m.showDate && (
                <div style={{ textAlign: "center", fontSize: 11, color: "#bbb",
                  margin: "8px 0", fontWeight: 500 }}>
                  {m.dateLabel}
                </div>
              )}
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "75%",
                  background: isMe ? G : "white",
                  color: isMe ? "white" : "#1a1a1a",
                  borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding: "8px 12px",
                  border: isMe ? "none" : "0.5px solid #eee",
                  boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                  opacity: m._optimistic ? 0.7 : 1,
                }}>
                  {!isMe && (
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 3,
                      color: G, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                      {m.sender_name}
                    </div>
                  )}
                  <div style={{ fontSize: 13, lineHeight: 1.45 }}>{m.content}</div>
                  <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6,
                    textAlign: isMe ? "right" : "left" }}>
                    {fmtTime(m.created_at)}
                    {isMe && !m._optimistic && (
                      <span style={{ marginLeft: 4 }}>{m.is_read ? "✓✓" : "✓"}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input (ou barre "conversation bloquée") */}
      {blocked ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "12px 16px", borderTop: "0.5px solid #f0f0f0", background: "white" }}>
          <span style={{ fontSize: 12.5, color: "#888" }}>Vous avez bloqué cette conversation.</span>
          <button onClick={toggleBlock}
            style={{ border: "none", background: "#f0eadf", color: "#333", borderRadius: 8,
              padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Débloquer</button>
        </div>
      ) : (
      <div style={{ display: "flex", gap: 8, padding: "10px 12px",
        borderTop: "0.5px solid #f0f0f0", background: "white", alignItems: "flex-end" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Votre message…"
          style={{ flex: 1, border: "0.5px solid #eee", borderRadius: 20,
            padding: "9px 14px", fontSize: 13, outline: "none",
            background: "#fafafa", color: "#333", resize: "none" }}
        />
        <motion.button whileTap={{ scale: 0.92 }} onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{ width: 38, height: 38, borderRadius: "50%", border: "none",
            background: input.trim() ? G : "#eee",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: input.trim() ? "pointer" : "default",
            flexShrink: 0, transition: "background 0.2s" }}>
          <Send size={15} color={input.trim() ? "white" : "#bbb"} />
        </motion.button>
      </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
