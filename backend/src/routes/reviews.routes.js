import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as ctrl from "../controllers/reviews.controller.js";

const router = Router();

// Public — liste des avis d'un restaurant
router.get ("/:slug/reviews",           ctrl.listReviews);

// Authentifié — vérifier si l'utilisateur peut laisser un avis
router.get ("/:slug/reviews/can-review", authenticate, ctrl.canReview);

// Authentifié client — créer / mettre à jour un avis
router.post("/:slug/reviews",            authenticate, ctrl.createReview);

export default router;
