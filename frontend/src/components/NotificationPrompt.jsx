import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { initPushNotifications } from "../services/push.js";

const AMBER = "#E8A045";
const DARK = "#1E2E28";
const FONT = "'Avenir Next','Avenir','Century Gothic',sans-serif";

/**
 * Pré-invite d'opt-in aux notifications (bonne pratique iOS/Android) :
 * on explique l'intérêt AVANT de déclencher le dialogue système, ce qui
 * augmente le taux d'acceptation et évite de "brûler" la demande native.
 * S'affiche une seule fois, uniquement dans l'app native, une fois connecté.
 */
export default function NotificationPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!Capacitor?.isNativePlatform?.()) return; // web → jamais
    let asked = null;
    try { asked = localStorage.getItem("tci_notif_optin"); } catch {}
    if (asked) return; // déjà répondu (granted / dismissed)
    const t = setTimeout(() => setShow(true), 1800); // laisse l'app se poser
    return () => clearTimeout(t);
  }, [user]);

  const choose = (value) => {
    setShow(false);
    try { localStorage.setItem("tci_notif_optin", value); } catch {}
    if (value === "granted") initPushNotifications(); // déclenche le dialogue natif
  };

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(30,46,40,.55)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            padding: "0 0 calc(24px + env(safe-area-inset-bottom, 0px))", fontFamily: FONT }}>
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 24, padding: "28px 24px 24px",
              width: "calc(100% - 32px)", maxWidth: 420, textAlign: "center",
              boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 18px",
              background: AMBER + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={34} color={AMBER} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: DARK, margin: "0 0 10px", letterSpacing: "-.3px" }}>
              Activer les notifications ?
            </h3>
            <p style={{ fontSize: 14.5, color: "#6b665d", lineHeight: 1.55, margin: "0 0 22px" }}>
              Soyez prévenu <strong>dès qu'une réservation est confirmée</strong>, et ne manquez
              aucune mise à jour importante de vos tables.
            </p>
            <button onClick={() => choose("granted")}
              style={{ width: "100%", background: DARK, color: "#fff", border: "none",
                borderRadius: 14, padding: "15px 0", fontSize: 15.5, fontWeight: 700,
                cursor: "pointer", fontFamily: FONT }}>
              Activer les notifications
            </button>
            <button onClick={() => choose("dismissed")}
              style={{ width: "100%", background: "transparent", color: "#9a948a", border: "none",
                borderRadius: 14, padding: "13px 0 4px", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: FONT }}>
              Plus tard
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
