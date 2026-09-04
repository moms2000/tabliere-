import { Router } from "express";
import { authenticate, requireTab } from "../middleware/auth.js";
import { getMessages, sendMessage, getConversations } from "../controllers/chat.controller.js";

const router = Router();

// La messagerie client↔restaurant est liée aux réservations : côté restaurant,
// seul un membre du staff ayant l'onglet Réservations ou Clients y accède
// (requireTab ne restreint QUE le staff ; le client et le propriétaire passent).
// Sans ça, n'importe quel staff pouvait lire toutes les conversations privées.
router.use(authenticate);

router.get("/conversations",       requireTab("reservations", "clients"), getConversations);
router.get("/:reservation_id",     requireTab("reservations", "clients"), getMessages);
router.post("/:reservation_id",    requireTab("reservations", "clients"), sendMessage);

export default router;
