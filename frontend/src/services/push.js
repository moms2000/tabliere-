import { Capacitor } from "@capacitor/core";
import api from "./api.js";

/**
 * Initialise les notifications push natives (iOS/Android via Capacitor).
 * Ne fait rien sur le web. À appeler une fois l'utilisateur connecté.
 */
export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return; // web → pas de push natif

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.register();

    // Token reçu → l'enregistrer côté serveur (rattaché au compte)
    PushNotifications.addListener("registration", (token) => {
      const platform = Capacitor.getPlatform(); // "ios" | "android"
      api.post("/users/me/device-token", { token: token.value, platform }).catch(() => {});
    });

    PushNotifications.addListener("registrationError", () => {});

    // Notification cliquée → ouvrir la route éventuelle
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const route = action?.notification?.data?.route;
      if (route) window.location.href = route;
    });
  } catch (_) {
    // plugin absent (web) ou erreur — ignorer
  }
}
