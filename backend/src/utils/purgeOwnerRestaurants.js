/**
 * Gestion des restaurants d'un compte lors de sa suppression.
 *
 * Stratégie HYBRIDE (sûre) :
 *  - Restaurant VIDE (aucune réservation, commande NI paiement — typiquement une
 *    inscription test/erronée) → suppression DÉFINITIVE (tables, menu, avis,
 *    favoris… partent en cascade). Le slug/nom redevient disponible.
 *  - Restaurant AVEC des données réelles → masquage réversible (status suspendu +
 *    deleted_at) MAIS on LIBÈRE le slug (renommé 'deleted-<id>') pour que le nom
 *    puisse être réutilisé à une nouvelle inscription. Aucun historique détruit.
 *
 * À appeler DANS une transaction (le `client` fourni). On ne teste que les 3 FK
 * qui bloqueraient un DELETE (reservations, orders) + payments (préservation des
 * données financières) — vérifié : ce sont les seules références en RESTRICT.
 */
export async function purgeOwnerRestaurants(client, ownerId) {
  const { rows: restos } = await client.query(
    "SELECT id FROM restaurants WHERE owner_id = $1", [ownerId]
  );
  let hardDeleted = 0, freed = 0;
  for (const r of restos) {
    const { rows: [dep] } = await client.query(
      `SELECT (SELECT COUNT(*) FROM reservations WHERE restaurant_id = $1)
            + (SELECT COUNT(*) FROM orders       WHERE restaurant_id = $1)
            + (SELECT COUNT(*) FROM payments     WHERE restaurant_id = $1) AS n`,
      [r.id]
    );
    if (Number(dep.n) === 0) {
      await client.query("DELETE FROM restaurants WHERE id = $1", [r.id]); // cascade
      hardDeleted++;
    } else {
      await client.query(
        `UPDATE restaurants
           SET status = 'suspendu', deleted_at = NOW(), slug = 'deleted-' || id, updated_at = NOW()
         WHERE id = $1`, [r.id]
      );
      await client.query(
        `UPDATE reservations SET archived_at = NOW(), updated_at = NOW()
         WHERE restaurant_id = $1 AND archived_at IS NULL`, [r.id]
      );
      freed++;
    }
  }
  return { hardDeleted, freed };
}
