import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { reservationLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/eventReservations.controller.js";

const router = Router();

router.post ("/",             reservationLimiter, authenticate, ctrl.createEventReservation);
router.get  ("/mine",         authenticate, ctrl.listMine);           // avant "/"
router.get  ("/",             authenticate, ctrl.listForEvent);       // ?event_id=
router.patch("/:id/confirm",  authenticate, ctrl.confirmEventReservation);
router.patch("/:id/cancel",   authenticate, ctrl.cancelEventReservation);

export default router;
