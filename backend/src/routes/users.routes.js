import { Router } from "express";
import { authenticate, denyStaff } from "../middleware/auth.js";
import * as ctrl        from "../controllers/users.controller.js";

const router = Router();

// Ces routes agissent sur le COMPTE PERSONNEL (req.user.id). Un membre du staff
// agit avec l'id du propriétaire : on lui interdit donc TOUTES ces routes, pour
// qu'il ne puisse jamais modifier ni supprimer le compte du propriétaire.
router.use(authenticate, denyStaff);

router.get   ("/me/reservations", ctrl.myReservations);
router.patch ("/me",              ctrl.updateProfile);
router.delete("/me",              ctrl.deleteAccount);

// Favoris (synchro compte) + fidélité
router.get   ("/me/favorites",               ctrl.listFavorites);
router.post  ("/me/favorites",               ctrl.addFavorite);
router.delete("/me/favorites/:restaurantId", ctrl.removeFavorite);
router.get   ("/me/loyalty",                 ctrl.getLoyalty);

// Notifications push natives
router.post  ("/me/device-token",            ctrl.registerDeviceToken);
router.post  ("/me/test-push",               ctrl.testPush);

export default router;
