import { Router } from "express";
import Joi from "joi";
import { validate }                from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl                   from "../controllers/menu.controller.js";

const router = Router();

// Public — accessible après scan QR
router.get("/:slug", ctrl.getPublicMenu);

// Restaurateur
const itemSchema = Joi.object({
  category_id:  Joi.string().uuid().required(),
  name:         Joi.string().min(2).max(255).required(),
  description:  Joi.string().max(1000).optional().allow("", null),
  price:        Joi.number().integer().min(0).required(),
  is_active:    Joi.boolean().default(true),
  is_available: Joi.boolean().optional(),
  position:     Joi.number().integer().default(0),
  image_url:    Joi.string().optional().allow("", null),   // photo du plat (URL ou base64)
  options:      Joi.any().optional(),                       // cuissons / accompagnements (JSONB)
});

router.get   ("/:slug/manage",    authenticate, authorize("restaurateur","admin"), ctrl.getFullMenu);
router.post  ("/import",          authenticate, authorize("restaurateur","admin"), ctrl.importMenu);
router.post  ("/items",           authenticate, authorize("restaurateur","admin"), validate(itemSchema), ctrl.createItem);
router.patch ("/items/:id",       authenticate, authorize("restaurateur","admin"), ctrl.updateItem);
router.delete("/items/:id",       authenticate, authorize("restaurateur","admin"), ctrl.deleteItem);
router.post  ("/categories",      authenticate, authorize("restaurateur","admin"), ctrl.createCategory);
router.patch ("/categories/:id",  authenticate, authorize("restaurateur","admin"), ctrl.updateCategory);
router.delete("/categories/:id",  authenticate, authorize("restaurateur","admin"), ctrl.deleteCategory);

export default router;
