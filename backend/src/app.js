import express     from "express";
import cors        from "cors";
import helmet      from "helmet";
import morgan      from "morgan";
import compression from "compression";

import { env }          from "./config/env.js";
import { poolStats }    from "./config/db.js";
import { redis }        from "./config/redis.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter }   from "./middleware/rateLimiter.js";
import { logger }       from "./utils/logger.js";

import authRoutes         from "./routes/auth.routes.js";
import usersRoutes        from "./routes/users.routes.js";
import restaurantsRoutes  from "./routes/restaurants.routes.js";
import reservationsRoutes from "./routes/reservations.routes.js";
import menuRoutes         from "./routes/menu.routes.js";
import paymentsRoutes     from "./routes/payments.routes.js";
import adminRoutes        from "./routes/admin.routes.js";
import chatRoutes         from "./routes/chat.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import ordersRoutes        from "./routes/orders.routes.js";
import reviewsRoutes       from "./routes/reviews.routes.js";
import reportsRoutes       from "./routes/reports.routes.js";
import uploadRoutes        from "./routes/upload.routes.js";
import storiesRoutes       from "./routes/stories.routes.js";
import eventsRoutes        from "./routes/events.routes.js";
import eventReservationsRoutes from "./routes/eventReservations.routes.js";
import eventOpsRoutes       from "./routes/eventOps.routes.js";

const app = express();

// ── Trust proxy (Render/Vercel sont derrière un reverse proxy) ──────────────
// Nécessaire pour que express-rate-limit identifie les IPs via X-Forwarded-For
app.set("trust proxy", 1);

// ── Compression gzip (réduit les réponses de 60-80%) ────────────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ── Forcer HTTPS en production ───────────────────────────────────────────────
app.use((req, res, next) => {
  if (env.isProd && req.headers["x-forwarded-proto"] === "http") {
    return res.redirect(301, "https://" + req.headers.host + req.url);
  }
  next();
});

// ── Sécurité (Helmet avec HSTS) ──────────────────────────────────────────────
app.use(helmet({
  hsts: {
    maxAge: 63072000,        // 2 ans
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: false, // géré côté Vercel pour le frontend
}));
const allowedOrigins = env.isProd
  ? [
      env.FRONTEND_URL,
      env.APP_URL,
      "https://tabliereci.net",
      "https://www.tabliereci.net",
      /\.vercel\.app$/,          // tous les previews Vercel
    ].filter(Boolean)
  : "*";

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins === "*") return cb(null, true);
    const ok = allowedOrigins.some((o) =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    cb(ok ? null : new Error("Not allowed by CORS"), ok);
  },
  credentials: true,
}));

// ── Parsing ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "8mb" })); // 8mb : autorise l'envoi d'images (data URI base64)
app.use(express.urlencoded({ extended: true }));

// ── Logs HTTP ───────────────────────────────────────────────────────────────
app.use(morgan(env.isProd ? "combined" : "dev", {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Rate limit global ───────────────────────────────────────────────────────
app.use("/api", apiLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────
const v1 = "/api/v1";
app.use(`${v1}/auth`,         authRoutes);
app.use(`${v1}/users`,        usersRoutes);
app.use(`${v1}/restaurants`,  restaurantsRoutes);
app.use(`${v1}/reservations`, reservationsRoutes);
app.use(`${v1}/menu`,         menuRoutes);
app.use(`${v1}/payments`,     paymentsRoutes);
app.use(`${v1}/admin`,         adminRoutes);
app.use(`${v1}/chat`,          chatRoutes);
app.use(`${v1}/notifications`, notificationsRoutes);
app.use(`${v1}/orders`,        ordersRoutes);
app.use(`${v1}/restaurants`,   reviewsRoutes);
app.use(`${v1}/reports`,       reportsRoutes);
app.use(`${v1}/upload`,        uploadRoutes);
app.use(`${v1}/stories`,       storiesRoutes);
app.use(`${v1}/events`,        eventsRoutes);
app.use(`${v1}/event-reservations`, eventReservationsRoutes);
app.use(v1, eventOpsRoutes); // /event-orders, /event-checkin, /event-staff/login

// ── Ping keep-alive (ultra-léger, empêche le cold start Render) ─────────────
app.get("/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  const db = poolStats();
  const healthy = db.waiting === 0 && db.total > 0;

  // Test Redis live — ping avec timeout 500ms
  let redisOk = false;
  let redisLatency = null;
  if (redis) {
    try {
      const t = Date.now();
      await Promise.race([
        redis.ping(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 500)),
      ]);
      redisOk = true;
      redisLatency = Date.now() - t;
    } catch { redisOk = false; }
  }

  res.status(healthy ? 200 : 503).json({
    status:    healthy ? "ok" : "degraded",
    ts:        new Date().toISOString(),
    uptime_s:  Math.floor(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1_048_576),
    db: {
      pool_total:   db.total,
      pool_idle:    db.idle,
      pool_waiting: db.waiting,
      pool_max:     db.max,
    },
    redis: {
      connected:  redisOk,
      latency_ms: redisLatency,
      url_set:    !!process.env.REDIS_URL,
    },
  });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route introuvable" }));

// ── Gestionnaire d'erreurs global ───────────────────────────────────────────
app.use(errorHandler);

export default app;
