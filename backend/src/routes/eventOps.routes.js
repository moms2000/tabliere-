import { Router } from "express";
import { ownerOrStaff } from "../middleware/eventAuth.js";
import { orderLimiter, pinLimiter } from "../middleware/rateLimiter.js";
import * as ops from "../controllers/eventOps.controller.js";
import { staffLogin } from "../controllers/events.controller.js";

const router = Router();

// Connexion staff (public : slug + PIN → token staff) — rate-limité comme les autres logins
router.post("/event-staff/login", pinLimiter, staffLogin);

// Commandes de bouteilles
router.post ("/event-orders/verify-pin",  pinLimiter,   ops.verifyOrderPin); // responsable : PIN → jeton (strict anti-brute-force)
router.get  ("/event-orders/mine",                      ops.listMyOrders);  // invité : suivi/historique via ?order_token= (public, scellé)
router.post ("/event-orders",             orderLimiter, ops.createOrder);   // invité (public, scan QR)
router.get  ("/event-orders",             ownerOrStaff, ops.listOrders);    // ?event_id= (organisateur/staff)
router.patch("/event-orders/:id/status",  ownerOrStaff, ops.updateOrderStatus);

// Interface serveur : ses tables assignées + commande directe (Phase 3)
router.get ("/event-server/tables",       ownerOrStaff, ops.listServerTables); // ?event_id=
router.post("/event-server/orders",       orderLimiter, ownerOrStaff, ops.createServerOrder);

// Check-in à l'entrée
router.get ("/event-checkin",             ownerOrStaff, ops.listCheckin);   // ?event_id=
router.post("/event-checkin/by-ref",      ownerOrStaff, ops.checkinByRef);
router.post("/event-checkin/:resaId/balance", ownerOrStaff, ops.recordBalance);
router.post("/event-checkin/:resaId",     ownerOrStaff, ops.doCheckin);

export default router;
