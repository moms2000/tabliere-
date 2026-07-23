import { Capacitor } from "@capacitor/core";
import api from "./api.js";

/**
 * Notifications push natives via Firebase Cloud Messaging (@capacitor-firebase/messaging).
 * Fournit un token FCM sur iOS ET Android → envoi unifié côté backend (firebase-admin).
 * Ne fait rien sur le web. À appeler une fois l'utilisateur connecté.
 */
export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return; // web → pas de push natif

  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

    const perm = await FirebaseMessaging.requestPermissions();
    if (perm.receive !== "granted") return;

    const saveToken = (token) => {
      if (!token) return;
      api.post("/users/me/device-token", { token, platform: Capacitor.getPlatform() }).catch(() => {});
    };

    // Token courant
    try {
      const { token } = await FirebaseMessaging.getToken();
      saveToken(token);
    } catch (_) {}

    // Rotation de token
    FirebaseMessaging.addListener("tokenReceived", (event) => saveToken(event?.token));

    // Notification cliquée → ouvrir la route éventuelle
    FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const route = event?.notification?.data?.route;
      // Uniquement des chemins INTERNES relatifs ("/...") — jamais une URL absolue
      // ni protocole-relative ("//evil.com") → pas d'open redirect via un payload.
      if (route && route.startsWith("/") && !route.startsWith("//")) window.location.href = route;
    });
  } catch (_) {
    // plugin absent (web) ou erreur — ignorer silencieusement
  }
}
