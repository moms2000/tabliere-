import { Router } from "express";
import { authenticate, authorize, requireTab } from "../middleware/auth.js";
import * as ctrl from "../controllers/sessions.controller.js";

const router = Router();

// Notes de table — restaurateur/admin, et staff ayant Commandes, Service rapide ou Reçus
router.use(authenticate, authorize("restaurateur", "admin"), requireTab("commandes", "pos", "recus"));

router.get   ("/",                  ctrl.listSessions);
router.get   ("/report",            ctrl.cashReport);   // avant /:id — rapport de caisse
router.post  ("/",                  ctrl.openSession);
router.get   ("/:id",               ctrl.getSession);
router.post  ("/:id/items",         ctrl.addItems);
router.patch ("/:id/items/:itemId", ctrl.updateItem);
router.post  ("/:id/convives",      ctrl.addConvive);
router.patch ("/:id/convives/:cid", ctrl.updateConvive);
router.post  ("/:id/pay",           ctrl.payForSession);   // encaissement (table ou par personne)
router.post  ("/:id/close",         ctrl.closeSession);

export default router;
