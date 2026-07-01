import { Router } from "express";
import Joi from "joi";
import { validate }     from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { authLimiter }  from "../middleware/rateLimiter.js";
import * as ctrl        from "../controllers/auth.controller.js";

const router = Router();

// ── Schémas de validation Joi ─────────────────────────────────────────────────

const registerSchema = Joi.object({
  full_name:         Joi.string().min(2).max(100).required(),
  email:             Joi.string().email().lowercase().required(),
  phone:             Joi.string().pattern(/^\+?[0-9]{8,15}$/).optional().allow("", null),
  password:          Joi.string().min(8).required(),
  role:              Joi.string().valid("client", "restaurateur").default("client"),
  restaurant_name:   Joi.when("role", {
    is:        "restaurateur",
    then:      Joi.string().min(2).max(150).required(),
    otherwise: Joi.optional().allow("", null),
  }),
  // ← CODE OBLIGATOIRE POUR LES RESTAURATEURS (Joi ne doit PAS le stripper)
  code_restaurateur: Joi.when("role", {
    is:        "restaurateur",
    then:      Joi.string().min(5).max(20).required(),
    otherwise: Joi.optional().allow("", null),
  }),
  date_naissance: Joi.string().optional().allow("", null),
}).options({ stripUnknown: false }); // ← garder tous les champs non listés

const loginSchema = Joi.object({
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const forgotSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetSchema = Joi.object({
  token:    Joi.string().required(),
  password: Joi.string().min(8).required(),
});

const verifyCodeSchema = Joi.object({
  code: Joi.string().min(5).max(20).required(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/register",        authLimiter, validate(registerSchema),    ctrl.register);
router.post("/login",           authLimiter, validate(loginSchema),       ctrl.login);
router.post("/logout",          authenticate,                              ctrl.logout);
router.post("/refresh",         authLimiter,                               ctrl.refresh);
router.get ("/me",              authenticate,                              ctrl.me);

// Code restaurateur
router.post("/verify-code",     authLimiter, validate(verifyCodeSchema),  ctrl.verifyRestaurateurCode);

// Vérification e-mail
router.get ("/verify-email",                                              ctrl.verifyEmail);
router.post("/resend-verification", authLimiter,                          ctrl.resendVerification);

// Mot de passe oublié
router.post("/forgot-password", authLimiter, validate(forgotSchema),      ctrl.forgotPassword);
router.post("/reset-password",  authLimiter, validate(resetSchema),       ctrl.resetPassword);

export default router;
