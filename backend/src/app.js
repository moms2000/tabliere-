import express     from "express";
import cors        from "cors";
import helmet      from "helmet";
import morgan      from "morgan";
import compression from "compression";

import { env }          from "./config/env.js";
import { poolStats }    from "./config/db.js";
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

const app = express();

// ── Compression gzip (réduit les réponses de 60-80%) ────────────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ── Sécurité ────────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = env.isProd
  ? [
      env.FRONTEND_URL,
      env.APP_URL,
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
app.use(express.json({ limit: "2mb" }));
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

// ── Ping keep-alive (ultra-léger, empêche le cold start Render) ─────────────
app.get("/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  const db = poolStats();
  const healthy = db.waiting === 0 && db.total > 0;
  res.status(healthy ? 200 : 503).json({
    status:    healthy ? "ok" : "degraded",
    ts:        new Date().toISOString(),
    uptime_s:  Math.floor(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1_048_576),
    db: {
      pool_total:   db.total,    // connexions ouvertes
      pool_idle:    db.idle,     // disponibles
      pool_waiting: db.waiting,  // requêtes en attente (0 = bonne santé)
      pool_max:     db.max,
    },
  });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route introuvable" }));

// ── Gestionnaire d'erreurs global ───────────────────────────────────────────
app.use(errorHandler);

export default app;
