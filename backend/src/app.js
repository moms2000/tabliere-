import express     from "express";
import cors        from "cors";
import helmet      from "helmet";
import morgan      from "morgan";
import compression from "compression";

import { env }          from "./config/env.js";
import { poolStats, query } from "./config/db.js";
import { redis }        from "./config/redis.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter }   from "./middleware/rateLimiter.js";
import { authenticate, authorize } from "./middleware/auth.js";
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
import sessionsRoutes       from "./routes/sessions.routes.js";
import { maintenanceGuard, isMaintenanceOn } from "./middleware/maintenance.js";

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
const keepRawBody = (req, _res, buf) => { req.rawBody = buf; }; // corps brut → vérif signature webhooks
// Corps large (8 Mo) UNIQUEMENT sur l'upload d'images (base64). Doit être monté
// AVANT le parser global pour prendre le pas sur cette route.
app.use("/api/v1/upload", express.json({ limit: "8mb", verify: keepRawBody }));
// Partout ailleurs : 2 Mo (les images sont compressées côté client avant envoi).
// Réduit la surface DoS/mémoire sur auth/réservations/etc.
app.use(express.json({ limit: "2mb", verify: keepRawBody }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Logs HTTP ───────────────────────────────────────────────────────────────
app.use(morgan(env.isProd ? "combined" : "dev", {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Rate limit global ───────────────────────────────────────────────────────
app.use("/api", apiLimiter);

// ── Statut public (avant le mode maintenance) ───────────────────────────────
app.get("/api/v1/status", async (_req, res) => {
  res.json({ maintenance: await isMaintenanceOn() });
});

// ── Mode maintenance : ferme le site public (sauf admin) si activé ──────────
app.use(maintenanceGuard);

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
app.use(`${v1}/sessions`,      sessionsRoutes);
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
// LIVENESS PUR : réponse INSTANTANÉE (aucune I/O, aucune requête DB) → Render
// obtient toujours un 200 rapide au déploiement, quel que soit l'état de la base
// ou des migrations en cours. Diagnostics DB détaillés → /health/db.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime_s: Math.floor(process.uptime()) });
});

// Diagnostic détaillé (mémoire, pool DB) — ADMIN uniquement (non utilisé par le
// health check Render). Évite d'exposer publiquement l'état interne du serveur.
app.get("/health/db", authenticate, authorize("admin"), async (_req, res) => {
  const db = poolStats();
  let dbOk = false;
  try {
    await Promise.race([query("SELECT 1"), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 2000))]);
    dbOk = true;
  } catch { dbOk = false; }
  res.status(200).json({
    status: "ok", uptime_s: Math.floor(process.uptime()), memory_mb: Math.round(process.memoryUsage().heapUsed / 1_048_576),
    db: { ok: dbOk, pool_total: db.total, pool_idle: db.idle, pool_waiting: db.waiting },
  });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route introuvable" }));

// ── Gestionnaire d'erreurs global ───────────────────────────────────────────
app.use(errorHandler);

export default app;
