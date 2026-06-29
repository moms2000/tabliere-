import { Router } from "express";
import Joi from "joi";
import { validate }     from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { authLimiter }  from "../middleware/rateLimiter.js";
import * as ctrl        from "../controllers/auth.controller.js";

const router = Router();

const registerSchema = Joi.object({
  full_name:        Joi.string().min(2).max(100).required(),
  email:            Joi.string().email().lowercase().required(),
  phone:            Joi.string().pattern(/^\+?[\d\s\-]{8,20}$/).optional().allow("", null),
  password:         Joi.string().min(8).required(),
  role:             Joi.string().valid("client", "restaurateur").default("client"),
  restaurant_name:  Joi.when("role", { is: "restaurateur", then: Joi.string().min(2).required(), otherwise: Joi.optional() }),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

router.post("/register",            authLimiter, validate(registerSchema), ctrl.register);
router.post("/login",               authLimiter, validate(loginSchema),    ctrl.login);
router.post("/logout",              authenticate,                           ctrl.logout);
router.post("/refresh",             authLimiter,                            ctrl.refresh);
router.get ("/me",                  authenticate,                           ctrl.me);
router.get ("/verify-email",                                                ctrl.verifyEmail);
router.post("/resend-verification", authLimiter,                            ctrl.resendVerification);
router.post("/verify-code",          authLimiter,                            ctrl.verifyRestaurateurCode);
router.post("/forgot-password",     authLimiter,                            ctrl.forgotPassword);
router.post("/reset-password",      authLimiter,                            ctrl.resetPassword);

export default router;
