import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { reservationLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/eventReservations.controller.js";

const router = Router();

router.get  ("/ticket/:ref",  ctrl.getTicket);                        // PUBLIC : e-billet (QR si confirmé)
router.post ("/guest",        reservationLimiter, ctrl.createGuestReservation); // PUBLIC : réserver sans compte
router.post ("/",             reservationLimiter, authenticate, ctrl.createEventReservation);
router.post ("/manual",       authenticate, ctrl.createManualReservation); // organisateur
router.get  ("/mine",         authenticate, ctrl.listMine);           // avant "/"
router.get  ("/",             authenticate, ctrl.listForEvent);       // ?event_id=
router.patch("/:id/confirm",  authenticate, ctrl.confirmEventReservation); // = confirmer l'acompte
router.post ("/:id/resend-qr",authenticate, ctrl.resendQr);
router.patch("/:id/cancel",   authenticate, ctrl.cancelEventReservation);

export default router;
