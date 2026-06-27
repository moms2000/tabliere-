import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/orders.controller.js";

const router = Router();

// Public — client via QR
router.post("/", ctrl.createOrder);

// Restaurateur / Admin
router.get("/",        authenticate, authorize("restaurateur","admin"), ctrl.listOrders);
router.get("/stats",   authenticate, authorize("restaurateur","admin"), ctrl.getStats);
router.patch("/:id",   authenticate, authorize("restaurateur","admin"), ctrl.updateOrder);

export default router;
