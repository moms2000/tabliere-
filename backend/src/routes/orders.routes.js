import { Router } from "express";
import { authenticate, authorize, requireTab } from "../middleware/auth.js";
import { orderLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/orders.controller.js";

const router = Router();

// Public — client via QR (limité pour éviter le spam de commandes)
router.post("/", orderLimiter, ctrl.createOrder);

// Restaurateur / Admin — accessible au staff ayant Commandes, Service rapide ou Reçus
const ORDER_TABS = ["commandes", "pos", "recus"];
router.get   ("/",             authenticate, authorize("restaurateur","admin"), requireTab(...ORDER_TABS), ctrl.listOrders);
router.get   ("/stats",        authenticate, authorize("restaurateur","admin"), requireTab("dashboard", ...ORDER_TABS), ctrl.getStats);
router.post  ("/manual",       authenticate, authorize("restaurateur","admin"), requireTab(...ORDER_TABS), ctrl.createManualOrder);
router.patch ("/:id",          authenticate, authorize("restaurateur","admin"), requireTab(...ORDER_TABS), ctrl.updateOrder);
router.patch ("/:id/items",    authenticate, authorize("restaurateur","admin"), requireTab(...ORDER_TABS), ctrl.updateOrderItems);

export default router;
