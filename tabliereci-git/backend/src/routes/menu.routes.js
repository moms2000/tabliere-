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
  description:  Joi.string().max(1000).optional(),
  price:        Joi.number().integer().min(0).required(),
  is_active:    Joi.boolean().default(true),
  position:     Joi.number().integer().default(0),
});

router.get   ("/:slug/manage",    authenticate, authorize("restaurateur","admin"), ctrl.getFullMenu);
router.post  ("/items",           authenticate, authorize("restaurateur","admin"), validate(itemSchema), ctrl.createItem);
router.patch ("/items/:id",       authenticate, authorize("restaurateur","admin"), ctrl.updateItem);
router.delete("/items/:id",       authenticate, authorize("restaurateur","admin"), ctrl.deleteItem);
router.post  ("/categories",      authenticate, authorize("restaurateur","admin"), ctrl.createCategory);

export default router;
