import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { listNotifications, markAllRead, markOneRead } from "../controllers/notifications.controller.js";

const router = Router();
router.use(authenticate);

router.get("/",                  listNotifications);
router.patch("/read-all",        markAllRead);
router.patch("/:id/read",        markOneRead);

export default router;
