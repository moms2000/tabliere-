/**
 * BullMQ queues — entièrement optionnelles
 * Si REDIS_URL est absent, toutes les opérations sont des no-ops silencieux.
 * Le serveur démarre et fonctionne normalement sans Redis.
 */
import { whatsappService } from "../services/whatsapp.service.js";
import { emailService }    from "../services/email.service.js";
import { logger }          from "../utils/logger.js";
import { query }           from "../config/db.js";

const REDIS_URL = process.env.REDIS_URL;
const HAS_REDIS = !!REDIS_URL;

// ---------------------------------------------------------------------------
// No-op queue — utilisé quand Redis est absent
// ---------------------------------------------------------------------------
const noopQueue = {
  add:   async () => null,
  close: async () => {},
};

// ---------------------------------------------------------------------------
// Variables exportées (seront assignées si Redis disponible)
// ---------------------------------------------------------------------------
export let notificationQueue = noopQueue;
export let paymentQueue      = noopQueue;

// ---------------------------------------------------------------------------
// Processor de notifications (partagé)
// ---------------------------------------------------------------------------
async function processNotification(job) {
  const { name, data } = job;
  logger.info(`[Queue] Traitement notification: ${name}`, { jobId: job.id });

  switch (name) {
    case "confirmation": {
      const { rows: [user] } = await query(
        "SELECT full_name, phone, email FROM users WHERE id = $1", [data.userId]
      );
      if (user?.phone) {
        await whatsappService.sendReservationConfirmation({
          phone:      user.phone,
          name:       user.full_name,
          restoName:  data.restoName,
          reservedAt: data.reservedAt,
          partySize:  data.partySize,
          ref:        data.reservationRef,
        });
      }
      if (user?.email) {
        await emailService.sendReservationConfirmation({
          email:      user.email,
          name:       user.full_name,
          restoName:  data.restoName,
          reservedAt: data.reservedAt,
          partySize:  data.partySize,
          ref:        data.reservationRef,
        });
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
      if (resa?.phone) {
        await whatsappService.sendConfirmedByResto({
          phone:      resa.phone,
          name:       resa.full_name,
          restoName:  resa.resto_name,
          reservedAt: resa.reserved_at,
          partySize:  resa.party_size,
          ref:        resa.ref,
        });
      }
      if (resa?.email) {
        await emailService.sendConfirmedByResto({
          email:      resa.email,
          name:       resa.full_name,
          restoName:  resa.resto_name,
          reservedAt: resa.reserved_at,
          ref:        resa.ref,
        });
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
        await emailService.sendCancellation({
          email:     resa.email,
          name:      resa.full_name,
          restoName: resa.resto_name,
          ref:       resa.ref,
          reason:    resa.cancel_reason,
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
        });
      }
      break;
    }

    default:
      logger.warn(`[Queue] Type de notification inconnu: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Initialisation — uniquement si REDIS_URL est défini
// ---------------------------------------------------------------------------
let notificationWorker = null;
let paymentWorker      = null;

export async function initQueues() {
  if (!HAS_REDIS) {
    logger.warn("BullMQ désactivé — REDIS_URL absent. Notifications envoyées en mode synchrone.");
    return;
  }

  try {
    const { Queue, Worker } = await import("bullmq");

    const connection = {
      url: REDIS_URL,
      tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    };

    // Créer les queues seulement ici (pas au module-level)
    notificationQueue = new Queue("notifications", {
      connection,
      defaultJobOptions: {
        attempts:  3,
        backoff:   { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
      },
    });

    paymentQueue = new Queue("payments", {
      connection,
      defaultJobOptions: {
        attempts:  5,
        backoff:   { type: "exponential", delay: 10000 },
        removeOnComplete: { count: 50 },
        removeOnFail:     { count: 50 },
      },
    });

    notificationWorker = new Worker("notifications", processNotification, {
      connection,
      concurrency: 5,
    });

    notificationWorker.on("completed", (job) => {
      logger.info(`[Queue] Notification terminée`, { jobId: job.id, name: job.name });
    });
    notificationWorker.on("failed", (job, err) => {
      logger.error(`[Queue] Notification échouée`, { jobId: job?.id, name: job?.name, error: err.message });
    });

    logger.info("Queues BullMQ prêtes");
  } catch (err) {
    logger.warn("BullMQ non initialisé — mode dégradé sans queues", { error: err?.message });
    // On remet les no-ops au cas où
    notificationQueue = noopQueue;
    paymentQueue      = noopQueue;
  }
}

export async function closeQueues() {
  try {
    if (notificationWorker) await notificationWorker.close();
    if (paymentWorker)      await paymentWorker.close();
    if (notificationQueue !== noopQueue) await notificationQueue.close();
    if (paymentQueue      !== noopQueue) await paymentQueue.close();
    logger.info("Queues BullMQ fermées");
  } catch {}
}
