/**
 * Email Service — TablièreCI
 * Envoi transactionnel via SendGrid REST API.
 * En mode sandbox (SENDGRID_API_KEY vide), on log sans envoyer.
 */

import axios  from "axios";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

async function send({ to, subject, html, text }) {
  if (!env.SENDGRID_API_KEY) {
    logger.info(`[Email MOCK] → ${to} | ${subject}`);
    return { messageId: `mock-${Date.now()}` };
  }

  try {
    await axios.post(
      SENDGRID_URL,
      {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.EMAIL_FROM, name: "TablièreCI" },
        subject,
        content: [
          { type: "text/plain", value: text || subject },
          { type: "text/html",  value: html },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    logger.info("[Email] Envoyé", { to, subject });
    return { success: true };
  } catch (err) {
    logger.error("[Email] Erreur envoi", {
      to, subject, error: err.response?.data || err.message,
    });
    // Ne pas bloquer le flux principal si l'email échoue
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dt) {
  return new Date(dt).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

function baseLayout(content) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:580px;margin:32px auto;padding:0 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;background:#e8a045;color:#1a1000;padding:7px 20px;border-radius:20px;font-size:13px;font-weight:700;letter-spacing:0.3px;">TablièreCI</span>
    </div>
    <!-- Card -->
    <div style="background:white;border-radius:14px;padding:32px;border:1px solid #e4dfd8;">
      ${content}
    </div>
    <!-- Footer -->
    <p style="text-align:center;color:#c0bab4;font-size:11px;margin-top:18px;line-height:1.6;">
      TablièreCI — La réservation facile en Côte d'Ivoire<br>
      <a href="https://tabliereci.ci" style="color:#e8a045;text-decoration:none;">tabliereci.ci</a>
    </p>
  </div>
</body>
</html>`;
}

function resaBox({ restoName, date, partySize, ref }) {
  return `
  <div style="background:#fef6ec;border-radius:10px;padding:20px;margin:20px 0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="color:#9ba89f;font-size:13px;padding:5px 0;width:130px;">Restaurant</td>
          <td style="color:#1e2e28;font-size:13px;font-weight:600;">${restoName}</td></tr>
      <tr><td style="color:#9ba89f;font-size:13px;padding:5px 0;">Date &amp; heure</td>
          <td style="color:#1e2e28;font-size:13px;font-weight:600;">${date}</td></tr>
      ${partySize !== undefined ? `<tr><td style="color:#9ba89f;font-size:13px;padding:5px 0;">Couverts</td>
          <td style="color:#1e2e28;font-size:13px;font-weight:600;">${partySize} personne${partySize > 1 ? "s" : ""}</td></tr>` : ""}
      <tr><td style="color:#9ba89f;font-size:13px;padding:5px 0;">Référence</td>
          <td style="color:#e8a045;font-size:16px;font-weight:700;">${ref}</td></tr>
    </table>
  </div>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

async function sendReservationConfirmation({ email, name, restoName, reservedAt, partySize, ref }) {
  const date  = fmtDate(reservedAt);
  const first = name.split(" ")[0];

  const html = baseLayout(`
    <h1 style="font-size:22px;font-weight:300;color:#1e2e28;margin:0 0 6px;">Réservation enregistrée !</h1>
    <p style="color:#9ba89f;font-size:14px;margin:0 0 4px;">Bonjour ${first}, votre réservation est bien prise en compte.</p>
    ${resaBox({ restoName, date, partySize, ref })}
    <p style="color:#9ba89f;font-size:12px;line-height:1.6;text-align:center;margin:0;">
      Mentionnez la référence <strong style="color:#1e2e28;">${ref}</strong> à l'arrivée.<br>
      Annulation gratuite jusqu'à 2h avant.
    </p>
  `);

  return send({
    to: email,
    subject: `Réservation chez ${restoName} — ${ref}`,
    html,
    text: `Bonjour ${first}, réservation chez ${restoName} le ${date} pour ${partySize} personne(s). Réf : ${ref}`,
  });
}

async function sendConfirmedByResto({ email, name, restoName, reservedAt, ref }) {
  const date  = fmtDate(reservedAt);
  const first = name.split(" ")[0];

  const html = baseLayout(`
    <div style="display:inline-flex;align-items:center;gap:7px;background:#f0f6f2;border-radius:20px;padding:5px 13px;margin-bottom:18px;">
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#3d6b55;"></span>
      <span style="font-size:11px;color:#3d6b55;font-weight:600;">Validée par le restaurant</span>
    </div>
    <h1 style="font-size:22px;font-weight:300;color:#1e2e28;margin:0 0 6px;">Bonne nouvelle, ${first} !</h1>
    <p style="color:#9ba89f;font-size:14px;margin:0 0 4px;">${restoName} a confirmé votre table.</p>
    ${resaBox({ restoName, date, ref })}
    <p style="color:#9ba89f;font-size:12px;text-align:center;margin:0;">Nous vous souhaitons un excellent repas !</p>
  `);

  return send({
    to: email,
    subject: `${restoName} confirme votre réservation — ${ref}`,
    html,
    text: `Bonjour ${first}, ${restoName} a confirmé votre réservation du ${date}. Réf : ${ref}`,
  });
}

async function sendCancellation({ email, name, restoName, ref, reason }) {
  const first = name.split(" ")[0];

  const html = baseLayout(`
    <h1 style="font-size:22px;font-weight:300;color:#1e2e28;margin:0 0 6px;">Réservation annulée</h1>
    <p style="color:#9ba89f;font-size:14px;margin:0 0 16px;">
      Bonjour ${first}, votre réservation <strong style="color:#1e2e28;">${ref}</strong> chez
      <strong style="color:#1e2e28;">${restoName}</strong> a été annulée.
    </p>
    ${reason ? `<div style="background:#fef6ec;border-radius:10px;padding:16px;font-size:13px;color:#9ba89f;margin-bottom:16px;">
      Motif : <strong style="color:#1e2e28;">${reason}</strong>
    </div>` : ""}
    <p style="color:#9ba89f;font-size:12px;text-align:center;margin:0;">
      Vous pouvez réserver une nouvelle table sur
      <a href="https://tabliereci.ci" style="color:#e8a045;text-decoration:none;">tabliereci.ci</a>
    </p>
  `);

  return send({
    to: email,
    subject: `Annulation réservation ${ref} — TablièreCI`,
    html,
    text: `Bonjour ${first}, votre réservation ${ref} chez ${restoName} a été annulée.${reason ? ` Motif : ${reason}` : ""}`,
  });
}

async function sendReminder({ email, name, restoName, reservedAt, ref }) {
  const date  = fmtDate(reservedAt);
  const first = name.split(" ")[0];

  const html = baseLayout(`
    <div style="display:inline-flex;align-items:center;gap:7px;background:#fef6ec;border-radius:20px;padding:5px 13px;margin-bottom:18px;">
      <span style="font-size:11px;color:#c47d1a;font-weight:600;">Rappel — demain</span>
    </div>
    <h1 style="font-size:22px;font-weight:300;color:#1e2e28;margin:0 0 6px;">Votre réservation est demain !</h1>
    <p style="color:#9ba89f;font-size:14px;margin:0 0 4px;">Bonjour ${first}, n'oubliez pas votre table chez ${restoName}.</p>
    ${resaBox({ restoName, date, ref })}
  `);

  return send({
    to: email,
    subject: `Rappel : votre table chez ${restoName} demain — ${ref}`,
    html,
    text: `Bonjour ${first}, rappel pour votre réservation chez ${restoName} le ${date}. Réf : ${ref}`,
  });
}

export const emailService = {
  sendReservationConfirmation,
  sendConfirmedByResto,
  sendCancellation,
  sendReminder,
};
