import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/admin.controller.js";

const router = Router();

// Toutes les routes admin nécessitent authentification + rôle admin
router.use(authenticate, authorize("admin"));

router.get   ("/stats",                    ctrl.getStats);
router.get   ("/export",                   ctrl.exportCSV);

// Paramètres plateforme
router.get   ("/settings",                 ctrl.getSettings);
router.patch ("/settings",                 ctrl.updateSettings);
router.post  ("/change-password",          ctrl.changeAdminPassword);

// Restaurants
router.get   ("/restaurants",              ctrl.listRestaurants);
router.patch ("/restaurants/batch",        ctrl.batchRestaurantStatus);
router.patch ("/restaurants/:id/status",   ctrl.setRestaurantStatus);
router.patch ("/restaurants/:id/plan",     ctrl.setRestaurantPlan);
router.patch ("/restaurants/:id/qr",       ctrl.toggleRestaurantQR);

// Utilisateurs
router.get   ("/users",                    ctrl.listUsers);
router.patch ("/users/batch",              ctrl.batchUserStatus);
router.patch ("/users/:id",                ctrl.updateUser);
router.patch ("/users/:id/status",         ctrl.setUserStatus);
router.delete("/users/:id",               ctrl.deleteUser);

// Paiements & Réservations
router.get   ("/payments",                 ctrl.listPayments);
router.get   ("/reservations",             ctrl.listReservations);
router.patch ("/reservations/:id",         ctrl.updateReservation);

export default router;
