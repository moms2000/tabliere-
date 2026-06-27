import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { listNotifications, markAllRead, markOneRead } from "../controllers/notifications.controller.js";
import { addConnection, removeConnection } from "../utils/sse.js";

const router = Router();
router.use(authenticate);

router.get("/",                  listNotifications);
router.patch("/read-all",        markAllRead);
router.patch("/:id/read",        markOneRead);

// ── GET /notifications/stream — connexion SSE ────────────────────────────────
router.get("/stream", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Nginx
  res.flushHeaders();

  const userId = String(req.user.id);
  addConnection(userId, res);

  // Ping toutes les 30s pour maintenir la connexion
  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch (_) { clearInterval(ping); }
  }, 30000);

  // Événement de connexion
  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  req.on("close", () => {
    clearInterval(ping);
    removeConnection(userId, res);
  });
});

export default router;
