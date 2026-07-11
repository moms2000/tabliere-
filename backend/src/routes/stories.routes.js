import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as ctrl from "../controllers/stories.controller.js";

const router = Router();

// Toutes les routes exigent d'être connecté (voir = incite à l'inscription)
router.post  ("/",            authenticate, ctrl.createStory);
router.post  ("/:id/react",   authenticate, ctrl.reactStory);
router.post  ("/:id/hide",    authenticate, ctrl.hideStory);
router.delete("/:id/react",   authenticate, ctrl.unreactStory);
router.delete("/:id",         authenticate, ctrl.deleteStory);
router.get   ("/:slug",       authenticate, ctrl.listStories);

export default router;
