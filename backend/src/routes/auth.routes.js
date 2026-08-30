import { Router } from "express";
import Joi from "joi";
import { validate }     from "../middleware/validate.js";
import { authenticate, denyStaff } from "../middleware/auth.js";
import { authLimiter, otpLimiter } from "../middleware/rateLimiter.js";
import * as ctrl        from "../controllers/auth.controller.js";
import * as otpCtrl     from "../controllers/otpAuth.controller.js";

const router = Router();

// ── Schémas de validation Joi ─────────────────────────────────────────────────

const registerSchema = Joi.object({
  full_name:         Joi.string().min(2).max(100).required(),
  email:             Joi.string().email().lowercase().required(),
  phone:             Joi.string().pattern(/^\+?[0-9]{8,15}$/).optional().allow("", null),
  password:          Joi.string().min(8).required(),
  role:              Joi.string().valid("client", "restaurateur", "organisateur").default("client"),
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
  // ← CODE OBLIGATOIRE POUR LES ORGANISATEURS
  code_organisateur: Joi.when("role", {
    is:        "organisateur",
    then:      Joi.string().min(5).max(20).required(),
    otherwise: Joi.optional().allow("", null),
  }),
  date_naissance: Joi.string().optional().allow("", null),
}).options({ stripUnknown: false }); // ← garder tous les champs non listés

const loginSchema = Joi.object({
  // Identifiant = numéro OU email (au moins un). `email` reste accepté pour la
  // rétrocompatibilité. La connexion ne fait qu'authentifier un compte existant.
  identifier: Joi.string().max(200).optional(),
  email:      Joi.string().email({ tlds: { allow: false } }).lowercase().optional(),
  phone:      Joi.string().max(30).optional(),
  password:   Joi.string().required(),
}).or("identifier", "email", "phone");

// ── OTP par téléphone (WhatsApp) ──────────────────────────────────────────────
const phoneField = Joi.string().pattern(/^\+?[0-9\s().-]{8,20}$/).required();
const otpSendSchema = Joi.object({
  phone:   phoneField,
  purpose: Joi.string().valid("register", "reset").default("register"),
});
const otpVerifySchema = Joi.object({
  phone:   phoneField,
  code:    Joi.string().pattern(/^\d{6}$/).required(),
  purpose: Joi.string().valid("register", "reset").default("register"),
});
const otpRegisterSchema = Joi.object({
  otp_ticket:        Joi.string().required(),
  full_name:         Joi.string().min(2).max(100).required(),
  password:          Joi.string().min(8).required(),
  email:             Joi.string().email().lowercase().optional().allow("", null),
  role:              Joi.string().valid("client", "restaurateur", "organisateur").default("client"),
  restaurant_name:   Joi.when("role", {
    is:        "restaurateur",
    then:      Joi.string().min(2).max(150).required(),
    otherwise: Joi.optional().allow("", null),
  }),
  code_restaurateur: Joi.string().min(5).max(20).optional().allow("", null),
  code_organisateur: Joi.string().min(5).max(20).optional().allow("", null),
}).options({ stripUnknown: false });
const otpResetSchema = Joi.object({
  otp_ticket: Joi.string().required(),
  password:   Joi.string().min(8).required(),
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
router.get ("/me",              authenticate, denyStaff,                   ctrl.me);

// Code restaurateur
router.post("/verify-code",     authLimiter, validate(verifyCodeSchema),  ctrl.verifyRestaurateurCode);

// Vérification e-mail
router.get ("/verify-email",                                              ctrl.verifyEmail);
router.post("/resend-verification", authLimiter,                          ctrl.resendVerification);

// Mot de passe oublié
router.post("/forgot-password", authLimiter, validate(forgotSchema),      ctrl.forgotPassword);
router.post("/reset-password",  authLimiter, validate(resetSchema),       ctrl.resetPassword);

// ── Inscription / réinitialisation par NUMÉRO + OTP WhatsApp ─────────────────
router.post("/otp/send",     otpLimiter, authLimiter, validate(otpSendSchema),     otpCtrl.sendOtp);
router.post("/otp/verify",   authLimiter, validate(otpVerifySchema),              otpCtrl.verifyOtp);
router.post("/otp/register", authLimiter, validate(otpRegisterSchema),            otpCtrl.registerPhone);
router.post("/otp/reset",    authLimiter, validate(otpResetSchema),               otpCtrl.resetPasswordPhone);

export default router;
