import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/events.controller.js";

const router = Router();
const orga = [authenticate, authorize("organisateur", "admin")];

// ── Public ──────────────────────────────────────────────────────────────────
router.get("/",              ctrl.listPublic);
router.get("/mine",          ...orga, ctrl.listMine);          // avant /:slug
router.get("/:slug/carte",   ctrl.listBottlesPublic);          // carte bouteilles (invités)
router.get("/:slug",         ctrl.getBySlug);

// ── Bouteilles / Staff / Promoteurs / Dashboard (propriétaire) ──────────────
router.get   ("/:id/dashboard",            ...orga, ctrl.getDashboard);
router.get   ("/:id/categories",           ...orga, ctrl.listCategories);
router.post  ("/:id/categories",           ...orga, ctrl.createCategory);
router.patch ("/:id/categories/:catId",    ...orga, ctrl.updateCategory);
router.delete("/:id/categories/:catId",    ...orga, ctrl.deleteCategory);
router.get   ("/:id/bottles",              ...orga, ctrl.listBottles);
router.post  ("/:id/bottles",              ...orga, ctrl.createBottle);
router.patch ("/:id/bottles/:bottleId",    ...orga, ctrl.updateBottle);
router.delete("/:id/bottles/:bottleId",    ...orga, ctrl.deleteBottle);
router.get   ("/:id/staff",                ...orga, ctrl.listStaff);
router.post  ("/:id/staff",                ...orga, ctrl.createStaff);
router.delete("/:id/staff/:staffId",       ...orga, ctrl.deleteStaff);
router.get   ("/:id/promoters",            ...orga, ctrl.listPromoters);
router.post  ("/:id/promoters",            ...orga, ctrl.createPromoter);
router.delete("/:id/promoters/:promoterId",...orga, ctrl.deletePromoter);

// ── Organisateur (propriétaire) ─────────────────────────────────────────────
router.post ("/",                       ...orga, ctrl.createEvent);
router.get  ("/:id/manage",             ...orga, ctrl.getManage);
router.patch("/:id",                    ...orga, ctrl.updateEvent);
router.post ("/:id/tables",             ...orga, ctrl.createTable);
router.patch("/:id/tables/:tableId",    ...orga, ctrl.updateTable);
router.delete("/:id/tables/:tableId",   ...orga, ctrl.deleteTable);

export default router;
