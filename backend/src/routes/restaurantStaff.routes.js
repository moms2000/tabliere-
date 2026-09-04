import { Router } from "express";
import { authenticate, authorize, denyStaff } from "../middleware/auth.js";
import { pinLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/restaurantStaff.controller.js";

const router = Router();

// Connexion staff (public : identifiant + PIN → token staff)
router.post("/login", pinLimiter, ctrl.login);

// Gestion — réservée au restaurateur propriétaire (jamais au staff lui-même).
// denyStaff rend la garde STRUCTURELLE (en plus du contrôle ownerRestoId dans
// chaque contrôleur) : un membre du staff ne peut jamais gérer d'autres staff.
router.use(authenticate, authorize("restaurateur", "admin"), denyStaff);
router.get   ("/",    ctrl.list);
router.post  ("/",    ctrl.create);
router.patch ("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

export default router;
