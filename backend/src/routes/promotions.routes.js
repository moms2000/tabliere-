import { Router } from "express";
import { authenticate, authorize, requireTab, denyStaff } from "../middleware/auth.js";
import { voucherLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/promotions.controller.js";

const router = Router();
router.use(authenticate);

// ── Admin : gestion des campagnes et cadeaux ─────────────────────────────────
const admin = authorize("admin");
router.post("/campaigns",             admin, ctrl.createCampaign);
router.get ("/campaigns",             admin, ctrl.listCampaigns);
router.post("/campaigns/:id/draw",    admin, ctrl.drawCampaign);
router.get ("/campaigns/:id/winners", admin, ctrl.listWinners);
router.delete("/campaigns/:id",       admin, ctrl.deleteCampaign);
router.get ("/clients",               admin, ctrl.listClients);
router.post("/gifts",                 admin, ctrl.createGift);

// ── Restaurateur / staff caisse : valider un bon présenté par un client ──────
router.post("/validate", voucherLimiter, authorize("restaurateur"), requireTab("recus", "commandes", "pos"), ctrl.validateVoucher);

// ── Client : mes cadeaux (bons) ──────────────────────────────────────────────
router.get("/mine", denyStaff, ctrl.myVouchers);

export default router;
