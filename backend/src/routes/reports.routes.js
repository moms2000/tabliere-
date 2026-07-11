import { Router } from "express";
import * as ctrl from "../controllers/reports.controller.js";

const router = Router();

// Public (rate-limité par apiLimiter) — signaler un avis / une conversation.
// Accessible sans compte pour permettre à tout utilisateur de signaler.
router.post("/", ctrl.createReport);

export default router;
