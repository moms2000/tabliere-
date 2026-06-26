import app           from "./app.js";
import { env }       from "./config/env.js";
import { connectDB } from "./config/db.js";
import { redis }     from "./config/redis.js";
import { initQueues, closeQueues } from "./queues/index.js";
import { logger }    from "./utils/logger.js";

let server;

async function start() {
  try {
    // Connexion PostgreSQL
    await connectDB();

    // Connexion Redis (optionnelle en dev sans Redis)
    try {
      await redis.connect();
    } catch (err) {
      logger.warn("Redis non disponible — cache et queues désactivés", { error: err.message });
    }

    // BullMQ workers
    try {
      await initQueues();
    } catch (err) {
      logger.warn("BullMQ non initialisé", { error: err.message });
    }

    server = app.listen(env.PORT, () => {
      logger.info("TablièreCI API démarrée", {
        port: env.PORT,
        env:  env.NODE_ENV,
        url:  `http://localhost:${env.PORT}`,
      });
    });
  } catch (err) {
    logger.error("Erreur au démarrage", { error: err.message });
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`Signal ${signal} — arrêt gracieux...`);
  try {
    await closeQueues();
    await redis.quit();
    if (server) server.close(() => {
      logger.info("Serveur HTTP fermé");
      process.exit(0);
    });
  } catch (err) {
    logger.error("Erreur à l'arrêt", { error: err.message });
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  (err) => logger.error("uncaughtException",  { error: err.message, stack: err.stack }));
process.on("unhandledRejection", (err) => logger.error("unhandledRejection", { error: err?.message }));

start();
