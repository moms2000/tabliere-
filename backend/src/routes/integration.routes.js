import { Router } from "express";
import { authenticate, authorize, denyStaff } from "../middleware/auth.js";
import { apiKeyAuth } from "../middleware/apiKeyAuth.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/integration.controller.js";

const router = Router();

// Gestion de l'intégration — PROPRIÉTAIRE uniquement (pas le staff).
const owner = [authenticate, authorize("restaurateur", "admin"), denyStaff];
router.get  ("/",     ...owner, ctrl.getConfig);
router.post ("/key",  ...owner, ctrl.generateKey);
router.patch("/",     ...owner, ctrl.updateConfig);

// Récupération des données par la caisse tierce — authentifiée par CLÉ API.
router.get ("/orders",   apiLimiter, apiKeyAuth, ctrl.pullOrders);
router.get ("/payments", apiLimiter, apiKeyAuth, ctrl.pullPayments);

export default router;
