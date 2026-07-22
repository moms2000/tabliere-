import { Router } from "express";
import { authenticate, requireTab } from "../middleware/auth.js";
import * as ctrl from "../controllers/stories.controller.js";

const router = Router();

// Toutes les routes exigent d'être connecté (voir = incite à l'inscription).
// Gestion des Instants (créer/masquer/supprimer) = onglet Instants pour le staff
// (requireTab n'a aucun effet pour un client, qui peut réagir/voir).
router.post  ("/",            authenticate, requireTab("instants"), ctrl.createStory);
router.post  ("/:id/react",   authenticate, ctrl.reactStory);
router.post  ("/:id/hide",    authenticate, requireTab("instants"), ctrl.hideStory);
router.delete("/:id/react",   authenticate, ctrl.unreactStory);
router.delete("/:id",         authenticate, requireTab("instants"), ctrl.deleteStory);
router.get   ("/:slug",       authenticate, ctrl.listStories);

export default router;
