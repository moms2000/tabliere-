import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as ctrl        from "../controllers/users.controller.js";

const router = Router();

router.get   ("/me/reservations", authenticate, ctrl.myReservations);
router.patch ("/me",              authenticate, ctrl.updateProfile);
router.delete("/me",              authenticate, ctrl.deleteAccount);

// Favoris (synchro compte) + fidélité
router.get   ("/me/favorites",               authenticate, ctrl.listFavorites);
router.post  ("/me/favorites",               authenticate, ctrl.addFavorite);
router.delete("/me/favorites/:restaurantId", authenticate, ctrl.removeFavorite);
router.get   ("/me/loyalty",                 authenticate, ctrl.getLoyalty);

// Notifications push natives
router.post  ("/me/device-token",            authenticate, ctrl.registerDeviceToken);

export default router;
