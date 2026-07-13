import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/admin.controller.js";

const router = Router();

// Toutes les routes admin nécessitent authentification + rôle admin
router.use(authenticate, authorize("admin"));

router.get   ("/stats",                    ctrl.getStats);
router.get   ("/analytics",                ctrl.getAnalytics);
router.get   ("/contacts",                 ctrl.getContacts);
router.get   ("/top-restaurants",          ctrl.getTopRestaurants);
router.get   ("/platform-stats",           ctrl.getPlatformStats);
router.get   ("/export",                   ctrl.exportCSV);

// Paramètres plateforme
router.get   ("/settings",                 ctrl.getSettings);
router.patch ("/settings",                 ctrl.updateSettings);
router.post  ("/change-password",          ctrl.changeAdminPassword);

// Restaurants
router.get   ("/restaurants",              ctrl.listRestaurants);
router.get   ("/restaurants/:id/detail",   ctrl.getRestaurantDetail);
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
router.get   ("/prospects",                ctrl.listProspects);
router.post  ("/codes/generate",           ctrl.generateCodes);
router.get   ("/codes",                    ctrl.listCodes);
router.delete("/codes/:id",                ctrl.deleteCode);

// Seed de charge (test de solidité) — admin uniquement
router.post  ("/seed",                     ctrl.seedRun);
router.post  ("/seed/clean",               ctrl.seedClean);
router.get   ("/seed/stats",               ctrl.seedStatus);

// Codes organisateurs (espace Événements)
router.post  ("/organisateur-codes/generate", ctrl.generateOrganisateurCodes);
router.get   ("/organisateur-codes",          ctrl.listOrganisateurCodes);
router.delete("/organisateur-codes/:id",      ctrl.deleteOrganisateurCode);

export default router;
