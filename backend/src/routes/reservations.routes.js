import { Router } from "express";
import Joi from "joi";
import { validate }                from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { reservationLimiter }      from "../middleware/rateLimiter.js";
import * as ctrl                   from "../controllers/reservations.controller.js";

const router = Router();

const createSchema = Joi.object({
  restaurant_id:   Joi.string().uuid().optional(), // optionnel pour les restaurateurs (utilisent req.user.restaurant_id)
  table_id:        Joi.string().uuid().optional(),
  reserved_at:     Joi.date().iso().required(),    // .min("now") retiré → le contrôleur gère la logique métier
  party_size:      Joi.number().integer().min(1).max(50).required(),
  special_request: Joi.string().max(500).allow("", null).optional(),
  walk_in_name:    Joi.string().max(255).allow("", null).optional(),
  walk_in_phone:   Joi.string().max(30).allow("", null).optional(),
});

router.post(
  "/",
  authenticate,
  authorize("client", "restaurateur", "admin"),
  validate(createSchema),
  ctrl.create
);

// Réservation invité (sans compte)
router.post("/guest", reservationLimiter, validate(
  Joi.object({
    restaurant_id:   Joi.string().uuid().required(),
    table_id:        Joi.string().uuid().optional(),
    reserved_at:     Joi.date().iso().required(),
    party_size:      Joi.number().integer().min(1).max(50).required(),
    special_request: Joi.string().max(500).allow("", null).optional(),
    walk_in_name:    Joi.string().max(255).required(),
    walk_in_phone:   Joi.string().min(8).max(30).required(), // obligatoire
    walk_in_email:   Joi.string().email().allow("", null).optional(),
    notes:           Joi.string().max(500).allow("", null).optional(),
  })
), ctrl.createGuest);

router.get("/",        authenticate,                          ctrl.list);
router.get("/:id",     authenticate,                          ctrl.getOne);
router.patch("/:id/confirm",      authenticate, authorize("restaurateur","admin"), ctrl.confirm);
router.patch("/:id/assign-table", authenticate, authorize("restaurateur","admin"), ctrl.assignTable);
router.patch("/:id/cancel",       authenticate,                                    ctrl.cancel);
router.patch("/:id/no-show",      authenticate, authorize("restaurateur","admin"), ctrl.noShow);
router.patch("/:id",              authenticate, authorize("restaurateur","admin"), ctrl.update);

export default router;
