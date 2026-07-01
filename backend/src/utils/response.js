// Standardise toutes les réponses API

export const ok = (res, data = {}, message = "Succès", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

export const created = (res, data = {}, message = "Créé avec succès") =>
  res.status(201).json({ success: true, message, data });

export const paginated = (res, data, meta) =>
  res.status(200).json({
    success: true,
    data,
    meta: {
      page:       meta.page,
      limit:      meta.limit,
      total:      meta.total,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  });

export const error = (res, message = "Erreur serveur", statusCode = 500, errors = null) =>
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });

export const notFound  = (res, msg = "Ressource introuvable") => error(res, msg, 404);
export const forbidden = (res, msg = "Accès refusé")          => error(res, msg, 403);
export const unauth    = (res, msg = "Non authentifié")        => error(res, msg, 401);
export const badRequest= (res, msg, errs = null)               => error(res, msg, 400, errs);
export const conflict  = (res, msg = "Conflit de données")     => error(res, msg, 409);
