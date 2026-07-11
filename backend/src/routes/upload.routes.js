import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as ctrl from "../controllers/upload.controller.js";

const router = Router();

// Téléverser une image (authentifié). Body: { file: dataURI, type: 'menu'|'restaurant'|'avatar'|'event' }
router.post("/", authenticate, ctrl.uploadOne);

export default router;
