import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getMessages, sendMessage, getConversations } from "../controllers/chat.controller.js";

const router = Router();

router.use(authenticate);

router.get("/conversations",       getConversations);
router.get("/:reservation_id",     getMessages);
router.post("/:reservation_id",    sendMessage);

export default router;
