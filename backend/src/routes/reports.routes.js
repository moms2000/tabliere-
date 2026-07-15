import { Router } from "express";
import { reservationLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/reports.controller.js";

const router = Router();

// Public mais limité (anti-spam de signalements) — signaler un avis / une conversation.
router.post("/", reservationLimiter, ctrl.createReport);

export default router;
