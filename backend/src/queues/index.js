import { whatsappService } from "../services/whatsapp.service.js";
import { sendPushToUser }  from "../services/push.service.js";
import { logger }          from "../utils/logger.js";
import { query }           from "../config/db.js";
import { env }             from "../config/env.js";
import axios               from "axios";
import QRCode              from "qrcode";

const FRONT = (env.FRONTEND_URL || "https://tabliereci.net").replace(/\/$/, "");
const fmtF = (n) => (Number(n) || 0).toLocaleString("fr-FR") + " FCFA";

// ---------------------------------------------------------------------------
// Mode d'envoi des notifications
// ---------------------------------------------------------------------------
// Par défaut : envoi INLINE (email + WhatsApp + push envoyés directement, sans
// file d'attente ni Redis). C'est le mode recommandé pour éviter la
// consommation permanente de commandes Redis par le polling de BullMQ
// (incompatible avec un Redis facturé à la commande type Upstash).
//
// Pour réactiver la file BullMQ (Redis dédié), poser USE_REDIS_QUEUE=true.
const USE_REDIS_QUEUE = process.env.USE_REDIS_QUEUE === "true" && !!process.env.REDIS_URL;

// ---------------------------------------------------------------------------
// Envoi email simple via SendGrid (inline pour éviter dépendances manquantes)
// ---------------------------------------------------------------------------
async function sendEmail({ to, subject, html, text, attachments }) {
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
      ...(attachments?.length ? { attachments } : {}),
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
// Traitement d'une notification (utilisé en inline ET par le worker BullMQ)
// ---------------------------------------------------------------------------
async function processNotification(name, data) {
  logger.info(`[Notif] Traitement: ${name}`);

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

      // Notification push native (si l'utilisateur a l'app)
      await sendPushToUser(data.userId, {
        title: isPending ? "Demande de réservation reçue" : "Réservation confirmée ✓",
        body:  `${data.restoName} — ${fmtDate(data.reservedAt)} · ${data.partySize} pers. (${data.reservationRef})`,
        data:  { route: "/profil?tab=reservations" },
      }).catch(() => {});
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

    // ── ÉVÉNEMENTS : cycle acompte (créée → en attente → confirmée / refusée) ──
    case "event_resa_pending": {
      const r = await getEventResa(data.reservationId);
      if (!r) break;
      const methods = Array.isArray(r.payment_methods) ? r.payment_methods : [];
      const dep = r.deposit_amount || 0;
      const table = r.table_label ? `${r.table_kind === "vip" ? "VIP · " : ""}${r.table_label}` : "Entrée";
      const mText = methods.length
        ? methods.map(m => `${m.operator} : ${m.number}${m.holder ? ` (${m.holder})` : ""}`).join(" | ")
        : "à demander à l'organisateur";
      const mHtml = methods.length
        ? methods.map(m => `<li style="margin:3px 0"><strong>${m.operator}</strong> : ${m.number}${m.holder ? ` <span style="color:#888">(${m.holder})</span>` : ""}</li>`).join("")
        : "<li>À demander à l'organisateur.</li>";
      const subject = `Réservation ${r.ref} — acompte requis pour confirmer`;
      if (r.email) await sendEmail({ to: r.email, subject,
        text: `Bonjour ${r.name}, votre réservation ${r.ref} pour ${r.event_name} (${fmtDate(r.starts_at)}, ${table}, ${r.party_size} pers.) est ENREGISTRÉE mais EN ATTENTE D'ACOMPTE${dep ? ` de ${fmtF(dep)}` : ""}. Payez via mobile money : ${mText}. Votre table n'est confirmée qu'APRÈS réception de l'acompte (premier payé, premier servi). Aucun QR code n'est encore émis.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
            <div style="background:#e8a045;padding:12px 20px;border-radius:8px 8px 0 0"><span style="color:#1a1000;font-size:16px;font-weight:bold">TablièreCI</span></div>
            <div style="background:#fff;padding:24px;border:1px solid #e4dfd8;border-top:none;border-radius:0 0 8px 8px">
              <h2 style="color:#1e2e28;margin:0 0 8px">Réservation en attente d'acompte</h2>
              <p style="color:#666">Bonjour <strong>${r.name}</strong>, votre demande est bien enregistrée.</p>
              <div style="background:#fef6ec;border-radius:8px;padding:16px;margin:14px 0">
                <p style="margin:4px 0"><strong>Événement :</strong> ${r.event_name}</p>
                <p style="margin:4px 0"><strong>Date :</strong> ${fmtDate(r.starts_at)}</p>
                <p style="margin:4px 0"><strong>Table :</strong> ${table} · ${r.party_size} pers.</p>
                <p style="margin:4px 0"><strong>Référence :</strong> <span style="color:#e8a045;font-weight:bold">${r.ref}</span></p>
                ${dep ? `<p style="margin:8px 0 0"><strong>Acompte à envoyer :</strong> <span style="color:#1e2e28;font-weight:bold;font-size:17px">${fmtF(dep)}</span></p>` : ""}
              </div>
              <p style="margin:0 0 6px;color:#1e2e28;font-weight:600">Payez l'acompte via mobile money :</p>
              <ul style="color:#444;font-size:14px;padding-left:18px;margin:0 0 14px">${mHtml}</ul>
              ${r.deposit_message ? `<p style="color:#666;font-size:13px">${r.deposit_message}</p>` : ""}
              <div style="background:#FFF7ED;border:1px solid #F0C98A;border-radius:8px;padding:12px;color:#7a5a1a;font-size:13px">
                ⚠️ Votre table n'est <strong>confirmée qu'après réception de l'acompte</strong> par l'organisateur.
                <strong>Premier acompte reçu, premier servi.</strong> Le <strong>QR code</strong> vous sera envoyé dès la confirmation.
              </div>
            </div>
            <p style="text-align:center;color:#aaa;font-size:11px;margin-top:12px">TablièreCI — <a href="https://tabliereci.net" style="color:#e8a045">tabliereci.net</a></p>
          </div>`,
      });
      if (r.phone) await whatsappService.sendText(r.phone,
        `Bonjour ${r.name}, votre réservation ${r.ref} pour *${r.event_name}* (${fmtDate(r.starts_at)}, ${table}) est enregistrée mais *en attente d'acompte*${dep ? ` de ${fmtF(dep)}` : ""}.\n\nPayez via : ${mText}\n\n⚠️ Table confirmée seulement après réception de l'acompte (1er payé, 1er servi). Le QR code vous sera envoyé après confirmation.`
      ).catch(() => {});
      break;
    }

    case "event_resa_confirmed": {
      const r = await getEventResa(data.reservationId);
      if (!r) break;
      const ticketUrl = `${FRONT}/billet/${encodeURIComponent(r.ref)}`;
      const table = r.table_label ? `${r.table_kind === "vip" ? "VIP · " : ""}${r.table_label}` : "Entrée";
      let attachments;
      try {
        const dataUrl = await QRCode.toDataURL(r.ref, { width: 320, margin: 1 });
        attachments = [{ content: dataUrl.split(",")[1], filename: `qr-${r.ref}.png`, type: "image/png", disposition: "inline", content_id: "qrcode" }];
      } catch { attachments = undefined; }
      if (r.email) await sendEmail({ to: r.email, subject: `✅ Réservation ${r.ref} confirmée — votre QR code`,
        text: `Bonjour ${r.name}, votre acompte est bien reçu ! Votre réservation ${r.ref} pour ${r.event_name} (${fmtDate(r.starts_at)}, ${table}) est CONFIRMÉE. Votre billet et QR code : ${ticketUrl}. Présentez ce QR à l'entrée.`,
        attachments,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
            <div style="background:#e8a045;padding:12px 20px;border-radius:8px 8px 0 0"><span style="color:#1a1000;font-size:16px;font-weight:bold">TablièreCI</span></div>
            <div style="background:#fff;padding:24px;border:1px solid #e4dfd8;border-top:none;border-radius:0 0 8px 8px;text-align:center">
              <div style="display:inline-block;background:#f0f6f2;border-radius:20px;padding:5px 13px;margin-bottom:14px"><span style="color:#3d6b55;font-size:12px;font-weight:600">✓ Acompte reçu · Table confirmée</span></div>
              <h2 style="color:#1e2e28;margin:0 0 8px">Votre réservation est confirmée, ${r.name} !</h2>
              <div style="background:#fef6ec;border-radius:8px;padding:16px;margin:14px 0;text-align:left">
                <p style="margin:4px 0"><strong>Événement :</strong> ${r.event_name}</p>
                <p style="margin:4px 0"><strong>Date :</strong> ${fmtDate(r.starts_at)}</p>
                <p style="margin:4px 0"><strong>Table :</strong> ${table} · ${r.party_size} pers.</p>
                <p style="margin:4px 0"><strong>Référence :</strong> <span style="color:#e8a045;font-weight:bold">${r.ref}</span></p>
              </div>
              ${attachments ? `<img src="cid:qrcode" alt="QR ${r.ref}" style="width:200px;height:200px;border:1px solid #e4dfd8;border-radius:10px;padding:8px;background:#fff" />` : ""}
              <p style="color:#666;font-size:13px;margin:14px 0 6px">Présentez ce QR code à l'entrée pour votre check-in.</p>
              <a href="${ticketUrl}" style="display:inline-block;background:#e8a045;color:#1a1000;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:9px;font-size:14px">Voir / télécharger mon billet</a>
            </div>
            <p style="text-align:center;color:#aaa;font-size:11px;margin-top:12px">TablièreCI — <a href="https://tabliereci.net" style="color:#e8a045">tabliereci.net</a></p>
          </div>`,
      });
      if (r.phone) await whatsappService.sendText(r.phone,
        `✅ ${r.name}, votre acompte est reçu ! Votre réservation ${r.ref} pour *${r.event_name}* (${fmtDate(r.starts_at)}, ${table}) est *confirmée*.\n\nVotre billet + QR code : ${ticketUrl}\nPrésentez-le à l'entrée. 🎉`
      ).catch(() => {});
      break;
    }

    case "event_resa_declined": {
      const r = await getEventResa(data.reservationId);
      if (!r) break;
      const reason = data.reason || "La table que vous aviez choisie n'est plus disponible (déjà attribuée à un autre client).";
      if (r.email) await sendEmail({ to: r.email, subject: `Réservation ${r.ref} — table indisponible`,
        text: `Bonjour ${r.name}, concernant votre réservation ${r.ref} pour ${r.event_name} : ${reason} Contactez l'organisateur pour choisir une autre table encore libre.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
            <div style="background:#e8a045;padding:12px 20px;border-radius:8px 8px 0 0"><span style="color:#1a1000;font-size:16px;font-weight:bold">TablièreCI</span></div>
            <div style="background:#fff;padding:24px;border:1px solid #e4dfd8;border-top:none;border-radius:0 0 8px 8px">
              <h2 style="color:#1e2e28;margin:0 0 8px">Table indisponible</h2>
              <p style="color:#666">Bonjour <strong>${r.name}</strong>,</p>
              <p style="color:#444">${reason}</p>
              <p style="color:#666;font-size:13px">Votre réservation <strong>${r.ref}</strong> (${r.event_name}). Contactez l'organisateur pour choisir une autre table encore libre.</p>
            </div>
            <p style="text-align:center;color:#aaa;font-size:11px;margin-top:12px">TablièreCI — <a href="https://tabliereci.net" style="color:#e8a045">tabliereci.net</a></p>
          </div>`,
      });
      if (r.phone) await whatsappService.sendText(r.phone,
        `Bonjour ${r.name}, concernant votre réservation ${r.ref} (*${r.event_name}*) : ${reason}\nContactez l'organisateur pour une autre table.`
      ).catch(() => {});
      break;
    }

    default:
      logger.warn(`[Notif] Type inconnu: ${name}`);
  }
}

// Détails d'une réservation événement pour les notifications (contact = compte OU invité)
async function getEventResa(id) {
  const { rows: [r] } = await query(
    `SELECT r.ref, r.party_size, r.status, r.deposit_amount,
            COALESCE(r.guest_name, u.full_name)  AS name,
            COALESCE(r.guest_email, u.email)      AS email,
            COALESCE(r.guest_phone, u.phone)      AS phone,
            e.name AS event_name, e.starts_at, e.payment_methods, e.deposit_message,
            t.label AS table_label, t.kind AS table_kind
     FROM event_reservations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN users u ON u.id = r.client_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.id = $1`, [id]
  );
  return r || null;
}

// ---------------------------------------------------------------------------
// Files d'attente
// ---------------------------------------------------------------------------
// API commune : notificationQueue.add(name, data) — inchangée pour les contrôleurs.
//   • Mode inline (défaut) : traite la notif directement, sans Redis.
//   • Mode BullMQ (USE_REDIS_QUEUE=true) : passe par la file Redis.
// ---------------------------------------------------------------------------
let notificationQueue;
let paymentQueue;
let notificationWorker;
let paymentWorker;

if (USE_REDIS_QUEUE) {
  // --- Mode file d'attente BullMQ (Redis dédié) ---------------------------
  const { Queue, Worker } = await import("bullmq");
  const REDIS_URL = process.env.REDIS_URL;
  const connection = {
    url:  REDIS_URL,
    tls:  REDIS_URL.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck:     false,
    lazyConnect:          true,
  };

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

  notificationWorker = new Worker(
    "notifications",
    async (job) => processNotification(job.name, job.data),
    { connection, concurrency: 5 }
  );
  notificationWorker.on("failed", (job, err) =>
    logger.error(`[Queue] Notification échouée`, { jobId: job?.id, name: job?.name, error: err.message }));
} else {
  // --- Mode inline (défaut, sans Redis) -----------------------------------
  // Traitement direct, fire-and-forget : ne bloque pas la réponse HTTP.
  const inlineQueue = {
    async add(name, data) {
      processNotification(name, data).catch((err) =>
        logger.warn(`[Notif] Échec traitement inline: ${name}`, { error: err?.message }));
      return { id: "inline" };
    },
  };
  notificationQueue = inlineQueue;
  paymentQueue      = inlineQueue;
}

export { notificationQueue, paymentQueue };

// ---------------------------------------------------------------------------
// Initialisation / fermeture (no-op en mode inline)
// ---------------------------------------------------------------------------
export async function initQueues() {
  if (USE_REDIS_QUEUE) {
    logger.info("Queues BullMQ prêtes (mode Redis)");
  } else {
    logger.info("Notifications en mode inline (sans Redis)");
  }
}

export async function closeQueues() {
  if (!USE_REDIS_QUEUE) return;
  if (notificationWorker) await notificationWorker.close().catch(() => {});
  if (paymentWorker)      await paymentWorker.close().catch(() => {});
  if (notificationQueue?.close) await notificationQueue.close().catch(() => {});
  if (paymentQueue?.close)      await paymentQueue.close().catch(() => {});
  logger.info("Queues BullMQ fermées");
}
