import { Queue, Worker } from "bullmq";
import { whatsappService } from "../services/whatsapp.service.js";
import { logger }          from "../utils/logger.js";
import { query }           from "../config/db.js";
import { env }             from "../config/env.js";
import axios               from "axios";

// ---------------------------------------------------------------------------
// Envoi email simple via SendGrid (inline pour éviter dépendances manquantes)
// ---------------------------------------------------------------------------
async function sendEmail({ to, subject, html, text }) {
  if (!env.SENDGRID_API_KEY) {
    logger.info(`[Email MOCK] → ${to} | ${subject}`);
    return;
  }
  const fromEmail = (env.EMAIL_FROM || "noreply@tabliereci.net")
    .replace("tabliereci.ci", "tabliereci.net");
  try {
    await axios.post("https://api.sendgrid.com/v3/mail/send", {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: "TablièreCI" },
      reply_to: { email: "contact@tabliereci.net", name: "TablièreCI" },
      subject,
      content: [
        { type: "text/plain", value: text || subject },
        { type: "text/html",  value: html  || `<p>${text}</p>` },
      ],
      headers: {
        "List-Unsubscribe": "<mailto:unsubscribe@tabliereci.net>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }, {
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    logger.info("[Email] Envoyé", { to, subject });
  } catch (e) {
    logger.warn("[Email] Échec envoi", { to, error: e.response?.data || e.message });
  }
}

function fmtDate(dt) {
  return new Date(dt).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Connexion Redis pour BullMQ — utilise REDIS_URL si disponible
// ---------------------------------------------------------------------------
const REDIS_URL = process.env.REDIS_URL;

const connection = REDIS_URL
  ? {
      url:  REDIS_URL,
      tls:  REDIS_URL.startsWith("rediss://") ? {} : undefined,
      // BullMQ requiert maxRetriesPerRequest: null
      maxRetriesPerRequest:  null,
      enableReadyCheck:      false,
      lazyConnect:           true,
    }
  : {
      host:     process.env.REDIS_HOST || "localhost",
      port:     parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    };

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------
export const notificationQueue = new Queue("notifications", {
  connection,
  defaultJobOptions: {
    attempts:  3,
    backoff:   { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50 },
  },
});

export const paymentQueue = new Queue("payments", {
  connection,
  defaultJobOptions: {
    attempts:  5,
    backoff:   { type: "exponential", delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail:     { count: 50 },
  },
});

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------
let notificationWorker;
let paymentWorker;

function createNotificationWorker() {
  notificationWorker = new Worker(
    "notifications",
    async (job) => {
      const { name, data } = job;
      logger.info(`[Queue] Traitement notification: ${name}`, { jobId: job.id });

      switch (name) {
        case "confirmation": {
          // Email + WhatsApp au client après réservation
          const { rows: [user] } = await query(
            "SELECT full_name, phone, email FROM users WHERE id = $1", [data.userId]
          );

          // Le message dépend du statut : confirmée (auto) ou en attente (manuel)
          const isPending = data.status === "en_attente";
          const titre   = isPending ? "Demande de réservation reçue" : "Réservation confirmée ✓";
          const sujet   = isPending
            ? `Demande de réservation chez ${data.restoName} — ${data.reservationRef}`
            : `Réservation confirmée chez ${data.restoName} — ${data.reservationRef}`;
          const noteBas = isPending
            ? "Votre demande a bien été reçue. Le restaurant va la confirmer prochainement — vous recevrez un e-mail dès validation."
            : "Mentionnez cette référence à votre arrivée. Annulation gratuite jusqu'à 2h avant.";

          if (user?.email) {
            await sendEmail({
              to:      user.email,
              subject: sujet,
              text:    `Bonjour ${user.full_name}, ${isPending ? "votre demande de réservation" : "votre réservation"} chez ${data.restoName} — ${fmtDate(data.reservedAt)}. Référence : ${data.reservationRef}. ${noteBas}`,
              html:    `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
                  <div style="background:#e8a045;padding:12px 20px;border-radius:8px 8px 0 0">
                    <span style="color:#1a1000;font-size:16px;font-weight:bold">TablièreCI</span>
                  </div>
                  <div style="background:#fff;padding:24px;border:1px solid #e4dfd8;border-top:none;border-radius:0 0 8px 8px">
                    <h2 style="color:#1e2e28;margin:0 0 8px">${titre}</h2>
                    <p style="color:#666">Bonjour <strong>${user.full_name}</strong>,</p>
                    <div style="background:#fef6ec;border-radius:8px;padding:16px;margin:16px 0">
                      <p style="margin:4px 0"><strong>Restaurant :</strong> ${data.restoName}</p>
                      <p style="margin:4px 0"><strong>Date :</strong> ${fmtDate(data.reservedAt)}</p>
                      <p style="margin:4px 0"><strong>Couverts :</strong> ${data.partySize} personne${data.partySize > 1 ? "s" : ""}</p>
                      <p style="margin:4px 0"><strong>Référence :</strong> <span style="color:#e8a045;font-weight:bold;font-size:18px">${data.reservationRef}</span></p>
                    </div>
                    <p style="color:#666;font-size:13px">${noteBas}</p>
                  </div>
                  <p style="text-align:center;color:#aaa;font-size:11px;margin-top:12px">TablièreCI — <a href="https://tabliereci.net" style="color:#e8a045">tabliereci.net</a></p>
                </div>`,
            });
          }

          // WhatsApp seulement si confirmée (pas pour une simple demande en attente)
          if (user?.phone && !isPending) {
            await whatsappService.sendReservationConfirmation({
              phone:      user.phone,
              name:       user.full_name,
              restoName:  data.restoName,
              reservedAt: data.reservedAt,
              partySize:  data.partySize,
              ref:        data.reservationRef,
            }).catch(() => {});
          }
          break;
        }

        case "confirmation_client": {
          const { rows: [resa] } = await query(
            `SELECT r.reserved_at, r.party_size, r.ref,
                    u.full_name, u.phone, u.email,
                    re.name AS resto_name
             FROM reservations r
             JOIN users u ON u.id = r.client_id
             JOIN restaurants re ON re.id = r.restaurant_id
             WHERE r.id = $1`,
            [data.reservationId]
          );

          // Email confirmation par le restaurant
          if (resa?.email) {
            await sendEmail({
              to:      resa.email,
              subject: `${resa.resto_name} confirme votre table — ${resa.ref}`,
              text:    `Bonne nouvelle ! ${resa.resto_name} a confirmé votre réservation du ${fmtDate(resa.reserved_at)}. Référence : ${resa.ref}.`,
              html:    `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
                  <div style="background:#e8a045;padding:12px 20px;border-radius:8px 8px 0 0">
                    <span style="color:#1a1000;font-size:16px;font-weight:bold">TablièreCI</span>
                  </div>
                  <div style="background:#fff;padding:24px;border:1px solid #e4dfd8;border-top:none;border-radius:0 0 8px 8px">
                    <div style="display:inline-block;background:#f0f6f2;border-radius:20px;padding:5px 13px;margin-bottom:16px">
                      <span style="color:#3d6b55;font-size:12px;font-weight:600">✓ Validée par le restaurant</span>
                    </div>
                    <h2 style="color:#1e2e28;margin:0 0 8px">Bonne nouvelle, ${resa.full_name} !</h2>
                    <p style="color:#666">${resa.resto_name} a confirmé votre table.</p>
                    <div style="background:#fef6ec;border-radius:8px;padding:16px;margin:16px 0">
                      <p style="margin:4px 0"><strong>Date :</strong> ${fmtDate(resa.reserved_at)}</p>
                      <p style="margin:4px 0"><strong>Référence :</strong> <span style="color:#e8a045;font-weight:bold">${resa.ref}</span></p>
                    </div>
                    <p style="color:#666;font-size:13px">Nous vous souhaitons un excellent repas !</p>
                  </div>
                  <p style="text-align:center;color:#aaa;font-size:11px;margin-top:12px">TablièreCI — <a href="https://tabliereci.net" style="color:#e8a045">tabliereci.net</a></p>
                </div>`,
            });
          }

          if (resa?.phone) {
            await whatsappService.sendConfirmedByResto({
              phone:      resa.phone,
              name:       resa.full_name,
              restoName:  resa.resto_name,
              reservedAt: resa.reserved_at,
              partySize:  resa.party_size,
              ref:        resa.ref,
            }).catch(() => {});
          }
          break;
        }

        case "cancellation": {
          const { rows: [resa] } = await query(
            `SELECT r.ref, r.cancel_reason,
                    u.full_name, u.email,
                    re.name AS resto_name
             FROM reservations r
             JOIN users u ON u.id = r.client_id
             JOIN restaurants re ON re.id = r.restaurant_id
             WHERE r.id = $1`,
            [data.reservationId]
          );
          if (resa?.email) {
            await sendEmail({
              to:      resa.email,
              subject: `Annulation réservation ${resa.ref} — TablièreCI`,
              text:    `Bonjour ${resa.full_name}, votre réservation ${resa.ref} chez ${resa.resto_name} a été annulée.${resa.cancel_reason ? ` Motif : ${resa.cancel_reason}` : ""}`,
              html:    `<p>Bonjour <strong>${resa.full_name}</strong>, votre réservation <strong>${resa.ref}</strong> chez <strong>${resa.resto_name}</strong> a été annulée.${resa.cancel_reason ? `<br>Motif : ${resa.cancel_reason}` : ""}</p>`,
            });
          }
          break;
        }

        case "payment_success": {
          const { rows: [user] } = await query(
            "SELECT full_name, phone FROM users WHERE id = $1", [data.userId]
          );
          if (user?.phone) {
            await whatsappService.sendPaymentSuccess({
              phone:  user.phone,
              name:   user.full_name,
              amount: data.amount,
              method: data.method,
            }).catch(() => {});
          }
          break;
        }

        default:
          logger.warn(`[Queue] Type de notification inconnu: ${name}`);
      }
    },
    { connection, concurrency: 5 }
  );

  notificationWorker.on("completed", (job) => {
    logger.info(`[Queue] Notification terminée`, { jobId: job.id, name: job.name });
  });
  notificationWorker.on("failed", (job, err) => {
    logger.error(`[Queue] Notification échouée`, { jobId: job?.id, name: job?.name, error: err.message });
  });

  return notificationWorker;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
export async function initQueues() {
  logger.info("Initialisation des queues BullMQ...");
  createNotificationWorker();
  logger.info("Queues BullMQ prêtes");
}

export async function closeQueues() {
  if (notificationWorker) await notificationWorker.close().catch(() => {});
  if (paymentWorker)      await paymentWorker.close().catch(() => {});
  await notificationQueue.close().catch(() => {});
  await paymentQueue.close().catch(() => {});
  logger.info("Queues BullMQ fermées");
}
