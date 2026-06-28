import { Queue, Worker } from "bullmq";
// redisClient non utilisé ici — BullMQ a sa propre connexion via `connection`
import { whatsappService } from "../services/whatsapp.service.js";
import { emailService }    from "../services/email.service.js";
import { logger }          from "../utils/logger.js";
import { query }           from "../config/db.js";

// ---------------------------------------------------------------------------
// Connexion Redis pour BullMQ (connection séparée du client principal)
// ---------------------------------------------------------------------------
const connection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : {
      host:     process.env.REDIS_HOST || "localhost",
      port:     parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
    };

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------
export const notificationQueue = new Queue("notifications", {
  connection,
  defaultJobOptions: {
    attempts:     3,
    backoff:      { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50 },
  },
});

export const paymentQueue = new Queue("payments", {
  connection,
  defaultJobOptions: {
    attempts:     5,
    backoff:      { type: "exponential", delay: 10000 },
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
          // WhatsApp + Email au client
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
  if (notificationWorker) await notificationWorker.close();
  if (paymentWorker)      await paymentWorker.close();
  await notificationQueue.close();
  await paymentQueue.close();
  logger.info("Queues BullMQ fermées");
}
