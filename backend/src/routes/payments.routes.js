import { Router } from "express";
import Joi from "joi";
import { validate }                from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { webhookLimiter }          from "../middleware/rateLimiter.js";
import * as ctrl                   from "../controllers/payments.controller.js";

const router = Router();

const initiateSchema = Joi.object({
  reservation_id: Joi.string().uuid().required(),
  method:  Joi.string().valid("orange_money","mtn_momo","wave","carte","cash").required(),
  phone:   Joi.string().pattern(/^\+?[0-9]{8,15}$/).optional(),
});

router.post("/initiate",            authenticate, validate(initiateSchema), ctrl.initiate);
router.post("/callback/:method",    webhookLimiter, ctrl.callback);  // webhook — signature vérifiée + rate-limité
router.get ("/status/:id",          authenticate, ctrl.getStatus);
router.post("/:id/refund",          authenticate, authorize("admin","restaurateur"), ctrl.refund);

export default router;
