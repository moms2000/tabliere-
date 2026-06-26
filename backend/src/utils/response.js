// Helpers de réponse standardisés — TablièreCI

export const success = (res, data = null, message = "Succès", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

// Alias court utilisé dans les controllers
export const ok = success;

export const created = (res, data = null, message = "Créé avec succès") =>
  success(res, data, message, 201);

export const badRequest = (res, message = "Requête invalide", errors = null) =>
  res.status(400).json({ success: false, message, errors });

export const unauthorized = (res, message = "Non authentifié") =>
  res.status(401).json({ success: false, message });

export const forbidden = (res, message = "Accès refusé") =>
  res.status(403).json({ success: false, message });

export const notFound = (res, message = "Ressource introuvable") =>
  res.status(404).json({ success: false, message });

export const conflict = (res, message = "Conflit de données") =>
  res.status(409).json({ success: false, message });

export const serverError = (res, message = "Erreur serveur interne") =>
  res.status(500).json({ success: false, message });

export const paginated = (res, rows, total, page, limit) =>
  res.status(200).json({
    success: true,
    data: rows,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
