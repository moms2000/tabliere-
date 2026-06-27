import pg from "pg";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("connect",  () => logger.debug("PostgreSQL — nouvelle connexion"));
pool.on("error",    (err) => logger.error("PostgreSQL — erreur pool", { error: err.message }));

export const connectDB = async () => {
  const client = await pool.connect();
  logger.info("PostgreSQL connecté");
  client.release();
};

// Helper principal — utiliser partout dans les controllers
export const query = (text, params) => pool.query(text, params);

// Transaction helper
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default pool;
