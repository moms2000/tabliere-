import { Router } from "express";
import Joi from "joi";
import { validate }                from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl                   from "../controllers/restaurants.controller.js";

const router = Router();

const tableSchema = Joi.object({
  label:    Joi.string().min(1).max(20).required(),
  capacity: Joi.number().integer().min(1).max(30).default(2),
  zone:     Joi.string().valid("interieur","terrasse","salon_prive").default("interieur"),
});

// ── Public ───────────────────────────────────────────────────────────────────
router.get("/",              ctrl.list);
router.get("/:slug",         ctrl.getOne);
router.get("/:slug/availability", ctrl.getAvailability);

// ── Restaurateur / Admin ─────────────────────────────────────────────────────
router.get  ("/:id/manage",        authenticate, authorize("restaurateur","admin"), ctrl.getManage);
router.patch("/:id",               authenticate, authorize("restaurateur","admin"), ctrl.update);
router.post ("/:id/qr",            authenticate, authorize("restaurateur","admin"), ctrl.generateQR);
router.post ("/:id/tables",        authenticate, authorize("restaurateur","admin"), validate(tableSchema), ctrl.createTable);
router.patch ("/:id/tables/:tableId",      authenticate, authorize("restaurateur","admin"), ctrl.updateTable);
router.delete("/:id/tables/:tableId",      authenticate, authorize("restaurateur","admin"), ctrl.deleteTable);
router.post  ("/:id/tables/:tableId/qr",   authenticate, authorize("restaurateur","admin"), ctrl.generateTableQR);

export default router;
