import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join }  from "path";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/tabliereci",
});

async function migrate() {
  const sqlPath = join(__dirname, "migrations", "002_chat_notifications_waitlist.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log("🔄  Connexion à la base de données...");
  const client = await pool.connect();
  try {
    console.log("🔄  Application de la migration 002...");
    await client.query(sql);
    console.log("✅  Migration 002 réussie !");
  } catch (err) {
    console.error("❌  Erreur :", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
