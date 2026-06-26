import express from "express";
import cors    from "cors";
import helmet  from "helmet";
import morgan  from "morgan";

import { env }          from "./config/env.js";
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

const app = express();

// ── Sécurité ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      env.isProd ? [env.FRONTEND_URL, env.APP_URL] : "*",
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
app.use(`${v1}/admin`,        adminRoutes);

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route introuvable" }));

// ── Gestionnaire d'erreurs global ───────────────────────────────────────────
app.use(errorHandler);

export default app;
