import { badRequest } from "../utils/response.js";

// Middleware de validation Joi — valide body, query ou params
export const validate = (schema, target = "body") => (req, res, next) => {
  const { error, value } = schema.validate(req[target], {
    abortEarly:   false, // retourner toutes les erreurs, pas juste la première
    stripUnknown: true,  // ignorer les champs non définis dans le schéma
    convert:      true,  // convertir les types (string "2" → number 2)
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return badRequest(res, "Données invalides", messages);
  }

  req[target] = value; // remplacer par les données validées/nettoyées
  next();
};
