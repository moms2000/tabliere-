import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";
import * as ctrl from "../controllers/upload.controller.js";

const router = Router();

// Téléverser une image (authentifié + limité). Body: { file: dataURI, type: 'menu'|'restaurant'|'avatar'|'event' }
router.post("/", uploadLimiter, authenticate, ctrl.uploadOne);

export default router;
