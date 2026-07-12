import { Router } from "express";
import { ownerOrStaff } from "../middleware/eventAuth.js";
import * as ops from "../controllers/eventOps.controller.js";
import { staffLogin } from "../controllers/events.controller.js";

const router = Router();

// Connexion staff (public : slug + PIN → token staff)
router.post("/event-staff/login", staffLogin);

// Commandes de bouteilles
router.post ("/event-orders",             ops.createOrder);                 // invité (public, scan QR)
router.get  ("/event-orders",             ownerOrStaff, ops.listOrders);    // ?event_id= (organisateur/staff)
router.patch("/event-orders/:id/status",  ownerOrStaff, ops.updateOrderStatus);

// Check-in à l'entrée
router.get ("/event-checkin",             ownerOrStaff, ops.listCheckin);   // ?event_id=
router.post("/event-checkin/by-ref",      ownerOrStaff, ops.checkinByRef);
router.post("/event-checkin/:resaId",     ownerOrStaff, ops.doCheckin);

export default router;
