import { Router } from "express";
import { reservationLimiter } from "../middleware/rateLimiter.js";
import { authenticate } from "../middleware/auth.js";
import * as ctrl from "../controllers/reports.controller.js";

const router = Router();

// Authentifié + limité : un signalement doit être traçable à son auteur
// (anti-harcèlement par signalements anonymes de masse).
router.post("/", authenticate, reservationLimiter, ctrl.createReport);

export default router;
