/**
 * Script de migration — TablièreCI
 * Lance le fichier SQL 001_initial.sql sur la base de données
 *
 * Usage : node src/db/migrate.js
 */

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
  const sqlPath = join(__dirname, "migrations", "001_initial.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log("🔄  Connexion à la base de données...");
  const client = await pool.connect();

  try {
    console.log("🔄  Application de la migration 001_initial.sql...");
    await client.query(sql);
    console.log("✅  Migration réussie !");
  } catch (err) {
    console.error("❌  Erreur de migration :", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
