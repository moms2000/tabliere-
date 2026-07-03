import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { orderLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/orders.controller.js";

const router = Router();

// Public — client via QR (limité pour éviter le spam de commandes)
router.post("/", orderLimiter, ctrl.createOrder);

// Restaurateur / Admin
router.get   ("/",             authenticate, authorize("restaurateur","admin"), ctrl.listOrders);
router.get   ("/stats",        authenticate, authorize("restaurateur","admin"), ctrl.getStats);
router.post  ("/manual",       authenticate, authorize("restaurateur","admin"), ctrl.createManualOrder);
router.patch ("/:id",          authenticate, authorize("restaurateur","admin"), ctrl.updateOrder);
router.patch ("/:id/items",    authenticate, authorize("restaurateur","admin"), ctrl.updateOrderItems);

export default router;
