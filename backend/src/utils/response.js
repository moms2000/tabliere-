// Standardise toutes les réponses API

export const ok = (res, data = {}, message = "Succès", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

export const created = (res, data = {}, message = "Créé avec succès") =>
  res.status(201).json({ success: true, message, data });

/**
 * Réponse paginée — accepte DEUX signatures pour compatibilité :
 *   paginated(res, data, { page, limit, total })          ← objet meta
 *   paginated(res, data, total, page, limit)              ← positionnel
 * Renvoie à la fois `pagination` ET `meta` (alias) car le frontend
 * lit `pagination` partout mais d'anciens appels attendaient `meta`.
 */
export const paginated = (res, data, metaOrTotal, page, limit) => {
  let total, p, l;
  if (metaOrTotal !== null && typeof metaOrTotal === "object") {
    total = metaOrTotal.total; p = metaOrTotal.page; l = metaOrTotal.limit;
  } else {
    total = metaOrTotal; p = page; l = limit;
  }
  total = Number(total) || 0;
  p     = Number(p) || 1;
  l     = Number(l) || 20;
  const pages = Math.max(1, Math.ceil(total / l));
  const info  = { page: p, limit: l, total, pages, totalPages: pages };
  return res.status(200).json({
    success:    true,
    data,
    pagination: info,   // ← clé lue par le frontend
    meta:       info,   // ← alias rétro-compatible
  });
};

export const error = (res, message = "Erreur serveur", statusCode = 500, errors = null) =>
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });

export const notFound  = (res, msg = "Ressource introuvable") => error(res, msg, 404);
export const forbidden = (res, msg = "Accès refusé")          => error(res, msg, 403);
export const unauth        = (res, msg = "Non authentifié")        => error(res, msg, 401);
export const unauthorized  = unauth; // alias pour compatibilité
export const badRequest= (res, msg, errs = null)               => error(res, msg, 400, errs);
export const conflict  = (res, msg = "Conflit de données")     => error(res, msg, 409);
