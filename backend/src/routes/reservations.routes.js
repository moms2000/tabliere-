import { Router } from "express";
import Joi from "joi";
import { validate }                from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { reservationLimiter }      from "../middleware/rateLimiter.js";
import * as ctrl                   from "../controllers/reservations.controller.js";

const router = Router();

const createSchema = Joi.object({
  restaurant_id: Joi.string().uuid().required(),
  table_id:      Joi.string().uuid().optional(),
  reserved_at:   Joi.date().iso().min("now").required(),
  party_size:    Joi.number().integer().min(1).max(50).required(),
  special_request: Joi.string().max(500).optional(),
});

router.post(
  "/",
  authenticate, reservationLimiter,
  validate(createSchema),
  ctrl.create
);

router.get("/",        authenticate,                          ctrl.list);
router.get("/:id",     authenticate,                          ctrl.getOne);
router.patch("/:id/confirm",      authenticate, authorize("restaurateur","admin"), ctrl.confirm);
router.patch("/:id/assign-table", authenticate, authorize("restaurateur","admin"), ctrl.assignTable);
router.patch("/:id/cancel",       authenticate,                                    ctrl.cancel);
router.patch("/:id/no-show",      authenticate, authorize("restaurateur","admin"), ctrl.noShow);

export default router;
