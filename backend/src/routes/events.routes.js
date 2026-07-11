import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/events.controller.js";

const router = Router();
const orga = [authenticate, authorize("organisateur", "admin")];

// ── Public ──────────────────────────────────────────────────────────────────
router.get("/",       ctrl.listPublic);
router.get("/mine",   ...orga, ctrl.listMine);      // avant /:slug
router.get("/:slug",  ctrl.getBySlug);

// ── Organisateur (propriétaire) ─────────────────────────────────────────────
router.post ("/",                       ...orga, ctrl.createEvent);
router.get  ("/:id/manage",             ...orga, ctrl.getManage);
router.patch("/:id",                    ...orga, ctrl.updateEvent);
router.post ("/:id/tables",             ...orga, ctrl.createTable);
router.patch("/:id/tables/:tableId",    ...orga, ctrl.updateTable);
router.delete("/:id/tables/:tableId",   ...orga, ctrl.deleteTable);

export default router;
