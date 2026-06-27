import { useState, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle, X, CalendarCheck } from "lucide-react";

const P      = "#E8A045";
const PL     = "#FEF6EC";
const S      = "#3D6B55";
const DARK   = "#1E2E28";
const BORDER = "#E4DFD8";
const FONT   = "'Avenir Next', 'Avenir', 'Century Gothic', 'Trebuchet MS', -apple-system, sans-serif";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success:     CheckCircle,
  reservation: CalendarCheck,
  info:        Bell,
};

const COLORS = {
  success:     S,
  reservation: P,
  info:        "#185FA5",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = "info", duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}

      {/* Toast container — bas droite */}
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        <AnimatePresence>
          {toasts.map(t => {
            const Icon  = ICONS[t.type] || Bell;
            const color = COLORS[t.type] || P;
            return (
              <motion.div key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.92 }}
                animate={{ opacity: 1, x: 0,  scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                style={{ background: "white", border: `0.5px solid ${BORDER}`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 12, padding: "12px 14px",
                  boxShadow: "0 4px 20px rgba(0,0,0,.12)",
                  display: "flex", alignItems: "flex-start", gap: 10,
                  maxWidth: 320, pointerEvents: "all", fontFamily: FONT }}>
                <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: DARK, flex: 1, lineHeight: 1.45 }}>
                  {t.message}
                </span>
                <button onClick={() => dismiss(t.id)}
                  style={{ border: "none", background: "transparent",
                    cursor: "pointer", color: "#ccc", display: "flex",
                    padding: 0, marginTop: 1, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
