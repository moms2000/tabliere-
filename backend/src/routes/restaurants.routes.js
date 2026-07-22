import { Router } from "express";
import Joi from "joi";
import { validate }                from "../middleware/validate.js";
import { authenticate, authorize, requireTab } from "../middleware/auth.js";
import * as ctrl                   from "../controllers/restaurants.controller.js";

const router = Router();

const tableSchema = Joi.object({
  label:    Joi.string().min(1).max(20).required(),
  capacity: Joi.number().integer().min(1).max(30).default(2),
  zone:     Joi.string().max(30).default("interieur"),   // zones par défaut OU personnalisées
  status:   Joi.string().optional(),
  pos_x:    Joi.number().integer().optional(),
  pos_y:    Joi.number().integer().optional(),
});

// ── Public ───────────────────────────────────────────────────────────────────
router.get("/",              ctrl.list);
router.get("/:slug",         ctrl.getOne);
router.get("/:slug/availability", ctrl.getAvailability);

// ── Restaurateur / Admin ─────────────────────────────────────────────────────
// getManage = lecture des infos du resto (tables, réglages) nécessaire à plusieurs
// onglets (plan, service, commandes) → accessible à tout staff ayant un de ces onglets.
router.get  ("/:id/manage",        authenticate, authorize("restaurateur","admin"), requireTab("plan","pos","commandes","recus","reservations","menu","dashboard","profil","instants","clients"), ctrl.getManage);
router.patch("/:id",               authenticate, authorize("restaurateur","admin"), requireTab("profil"), ctrl.update);
router.post ("/:id/qr",            authenticate, authorize("restaurateur","admin"), requireTab("menu"), ctrl.generateQR);
router.post ("/:id/tables",        authenticate, authorize("restaurateur","admin"), requireTab("plan"), validate(tableSchema), ctrl.createTable);
router.patch ("/:id/tables/:tableId",      authenticate, authorize("restaurateur","admin"), requireTab("plan"), ctrl.updateTable);
router.delete("/:id/tables/:tableId",      authenticate, authorize("restaurateur","admin"), requireTab("plan"), ctrl.deleteTable);
router.post  ("/:id/tables/:tableId/qr",   authenticate, authorize("restaurateur","admin"), requireTab("plan","menu"), ctrl.generateTableQR);

export default router;
