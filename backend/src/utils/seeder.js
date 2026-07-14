/**
 * Seeder de charge — génère des données FICTIVES marquées pour tester la solidité
 * (perf DB, index, pagination, recherche) puis les supprimer proprement.
 *
 * Marquage : tous les comptes utilisent le domaine e-mail @seedtest.local et les
 * restaurants un slug préfixé "seed-resto-". Le nettoyage cible ces marqueurs.
 *
 * Insertions GROUPÉES (multi-row VALUES) + hash bcrypt partagé (calculé 1 fois)
 * → rapide même pour des dizaines de milliers de lignes.
 */
import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { logger } from "../utils/logger.js";

const MARK_EMAIL = "@seedtest.local";
const MARK_SLUG  = "seed-resto-";
const CUISINES = ["Ivoirien", "Maquis", "Libanais", "Italien", "Fast-food", "Fruits de mer", "Grill", "Africain", "Français", "Asiatique"];
const VILLES   = ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Korhogo", "Daloa"];
const QUARTIERS = ["Cocody", "Plateau", "Marcory", "Yopougon", "Treichville", "Riviera", "Angré", "Koumassi"];
const FIRST = ["Awa", "Koffi", "Fatou", "Yao", "Aminata", "Serge", "Mariam", "Ibrahim", "Aya", "Kevin", "Grace", "Moussa"];
const LAST  = ["Kouassi", "Traoré", "Diarra", "N'Guessan", "Koné", "Bamba", "Yao", "Touré", "Cissé", "Coulibaly"];

const pick = (arr, i) => arr[i % arr.length];
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// Insert groupé : construit les $ placeholders pour `rows` de `cols` colonnes.
async function bulkInsert(table, cols, rows) {
  if (!rows.length) return [];
  const ids = [];
  for (const batch of chunk(rows, 500)) {
    const values = [];
    const placeholders = batch.map((row, r) => {
      const ph = row.map((_, c) => `$${r * cols.length + c + 1}`);
      values.push(...row);
      return `(${ph.join(",")})`;
    });
    const { rows: ret } = await query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${placeholders.join(",")} RETURNING id`,
      values
    );
    ids.push(...ret.map(x => x.id));
  }
  return ids;
}

/**
 * @param {{restaurants:number, clients:number, reservationsPerResto:number, visible:boolean, onProgress?:Function}} opts
 */
export async function seedLoad({ restaurants = 1000, clients = 10000, reservationsPerResto = 0, visible = false, onProgress = () => {} }) {
  const t0 = Date.now();
  const hash = await bcrypt.hash("SeedTest2026!", 10); // 1 seul hash partagé (rapide)
  const status = visible ? "actif" : "suspendu";
  onProgress(`Démarrage seed : ${restaurants} restos, ${clients} clients (${visible ? "publics" : "masqués"})`);

  // 1) Clients
  const clientRows = [];
  for (let i = 0; i < clients; i++) {
    clientRows.push([`${pick(FIRST, i)} ${pick(LAST, i * 3)}`, `seed-c-${i}${MARK_EMAIL}`, hash, "client", "actif"]);
  }
  const clientIds = await bulkInsert("users", ["full_name", "email", "password_hash", "role", "status"], clientRows);
  onProgress(`Clients créés : ${clientIds.length}`);

  // 2) Restaurateurs (1 par resto)
  const ownerRows = [];
  for (let i = 0; i < restaurants; i++) {
    ownerRows.push([`Gérant ${i}`, `seed-r-${i}${MARK_EMAIL}`, hash, "restaurateur", "actif"]);
  }
  const ownerIds = await bulkInsert("users", ["full_name", "email", "password_hash", "role", "status"], ownerRows);

  // 3) Restaurants
  const restoRows = ownerIds.map((ownerId, i) => [
    ownerId, `SEED Resto ${i}`, `${MARK_SLUG}${i}`, pick(CUISINES, i), pick(VILLES, i), pick(QUARTIERS, i * 2),
    status, 20 + (i % 80),
  ]);
  const restoIds = await bulkInsert(
    "restaurants",
    ["owner_id", "name", "slug", "cuisine_type", "ville", "quartier", "status", "capacity"],
    restoRows
  );
  // Rattacher restaurant_id aux gérants (batch)
  await query(
    `UPDATE users u SET restaurant_id = r.id FROM restaurants r
     WHERE r.owner_id = u.id AND u.email LIKE $1`,
    [`seed-r-%${MARK_EMAIL}`]
  );
  onProgress(`Restaurants créés : ${restoIds.length}`);

  // 4) Tables (4 par resto)
  const tableRows = [];
  restoIds.forEach((rid) => {
    for (let t = 1; t <= 4; t++) tableRows.push([rid, `T${t}`, 2 + t, "interieur"]);
  });
  await bulkInsert("restaurant_tables", ["restaurant_id", "label", "capacity", "zone"], tableRows);
  onProgress(`Tables créées : ${tableRows.length}`);

  // 5) Réservations (optionnel)
  let resaCount = 0;
  if (reservationsPerResto > 0 && clientIds.length) {
    const resaRows = [];
    restoIds.forEach((rid, ri) => {
      for (let k = 0; k < reservationsPerResto; k++) {
        const cid = clientIds[(ri * 7 + k) % clientIds.length];
        const daysAhead = (k % 14);
        resaRows.push([
          `SEED-${ri}-${k}`, rid, cid,
          `NOW() + interval '${daysAhead} days'`, // placeholder texte non paramétrable → on gère via SQL ci-dessous
          2 + (k % 6), "confirme",
        ]);
      }
    });
    // Insertion réservations avec reserved_at calculé en SQL (batch simple)
    for (const batch of chunk(resaRows, 500)) {
      const vals = [];
      const ph = batch.map((row, r) => {
        const base = r * 6;
        vals.push(row[0], row[1], row[2], row[4], row[5], (row[3].match(/\d+/) || [0])[0]);
        return `($${base+1},$${base+2},$${base+3}, NOW() + ($${base+6} || ' days')::interval, $${base+4}, $${base+5})`;
      });
      await query(
        `INSERT INTO reservations (ref, restaurant_id, client_id, reserved_at, party_size, status) VALUES ${ph.join(",")}`,
        vals
      );
      resaCount += batch.length;
    }
    onProgress(`Réservations créées : ${resaCount}`);
  }

  const secs = Math.round((Date.now() - t0) / 1000);
  const summary = { restaurants: restoIds.length, clients: clientIds.length, tables: tableRows.length, reservations: resaCount, seconds: secs, visible };
  logger.info("[Seed] Terminé", summary);
  onProgress(`✅ Terminé en ${secs}s`);
  return summary;
}

/**
 * Supprime TOUTES les données de seed (ordre FK : réservations → restaurants → users).
 * Suppression PAR LOTS : chaque requête reste sous le statement_timeout PostgreSQL
 * (15 s), sinon un gros DELETE (dizaines de milliers de lignes) est avorté.
 * Idempotent → relançable sans risque.
 */
const CLEAN_BATCH = 2000;
export async function cleanSeed({ onProgress = () => {} } = {}) {
  const t0 = Date.now();

  // Exécute `sql` en boucle tant qu'un lot plein est traité (rowCount === batch).
  const runBatched = async (sql, params, label) => {
    let total = 0, n;
    do {
      const r = await query(sql, params);
      n = r.rowCount || 0; total += n;
      if (n) onProgress(`${label} : ${total}`);
    } while (n >= CLEAN_BATCH);
    return total;
  };

  // 1) Réservations des restos seed
  const reservations = await runBatched(
    `DELETE FROM reservations WHERE id IN (
       SELECT id FROM reservations
       WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE $1)
       LIMIT ${CLEAN_BATCH})`,
    [`${MARK_SLUG}%`], "Réservations supprimées"
  );

  // 2) Détacher restaurant_id des gérants (FK users.restaurant_id) avant suppression des restos
  await runBatched(
    `UPDATE users SET restaurant_id = NULL WHERE id IN (
       SELECT id FROM users WHERE email LIKE $1 AND restaurant_id IS NOT NULL LIMIT ${CLEAN_BATCH})`,
    [`%${MARK_EMAIL}`], "Gérants détachés"
  );

  // 3) Restaurants seed (tables en CASCADE)
  const restaurants = await runBatched(
    `DELETE FROM restaurants WHERE id IN (
       SELECT id FROM restaurants WHERE slug LIKE $1 LIMIT ${CLEAN_BATCH})`,
    [`${MARK_SLUG}%`], "Restaurants supprimés"
  );

  // 4) Comptes seed
  const users = await runBatched(
    `DELETE FROM users WHERE id IN (
       SELECT id FROM users WHERE email LIKE $1 LIMIT ${CLEAN_BATCH})`,
    [`%${MARK_EMAIL}`], "Utilisateurs supprimés"
  );

  const secs = Math.round((Date.now() - t0) / 1000);
  const summary = { reservations, restaurants, users, seconds: secs };
  logger.info("[Seed] Nettoyage terminé", summary);
  return summary;
}

export async function seedStats() {
  const { rows: [r] } = await query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE email LIKE $1)::int AS users,
       (SELECT COUNT(*) FROM restaurants WHERE slug LIKE $2)::int AS restaurants,
       (SELECT COUNT(*) FROM reservations WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE $2))::int AS reservations`,
    [`%${MARK_EMAIL}`, `${MARK_SLUG}%`]
  );
  return r;
}
