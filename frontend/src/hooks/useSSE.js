import { useEffect, useRef, useCallback } from "react";
import { getStoredToken, BASE_URL } from "../services/api.js";

/**
 * useSSE — connexion Server-Sent Events pour les notifications temps réel
 * @param {Object} handlers - { eventName: (data) => void }
 * @param {Boolean} enabled - activer/désactiver la connexion
 */
export function useSSE(handlers = {}, enabled = true) {
  const esRef      = useRef(null);
  const retryRef   = useRef(null);
  const handlersRef = useRef(handlers);

  // Garder les handlers à jour sans re-créer la connexion
  useEffect(() => { handlersRef.current = handlers; });

  const connect = useCallback(() => {
    if (esRef.current) return; // déjà connecté

    const token = getStoredToken("access_token");
    if (!token) return;

    const url = `${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es  = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {};

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Reconnexion automatique après 5s — l'id est mémorisé pour pouvoir
      // annuler le timer au démontage (sinon fuite : reconnexion post-unmount)
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(connect, 5000);
    };

    // Écouteurs dynamiques basés sur les handlers fournis
    const EVENTS = ["connected","new_reservation","reservation_confirmed","reservation_cancelled","new_message"];
    EVENTS.forEach(evt => {
      es.addEventListener(evt, (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current[evt]?.(data);
          handlersRef.current["*"]?.(evt, data);
        } catch (_) {}
      });
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled, connect]);
}
