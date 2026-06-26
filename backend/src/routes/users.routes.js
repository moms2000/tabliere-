import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as ctrl        from "../controllers/users.controller.js";

const router = Router();

router.get   ("/me/reservations", authenticate, ctrl.myReservations);
router.patch ("/me",              authenticate, ctrl.updateProfile);
router.delete("/me",              authenticate, ctrl.deleteAccount);

export default router;
