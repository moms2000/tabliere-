import api from "./api.js";

export const eventsService = {
  // Public
  async listPublic(params = {}) { return (await api.get("/events", { params })).data; },
  async getBySlug(slug)         { return (await api.get(`/events/${slug}`)).data.data; },

  // Organisateur
  async listMine()              { return (await api.get("/events/mine")).data.data; },
  async create(data)            { return (await api.post("/events", data)).data.data; },
  async getManage(id)           { return (await api.get(`/events/${id}/manage`)).data.data; },
  async update(id, data)        { return (await api.patch(`/events/${id}`, data)).data.data; },

  // Plan de salle (tables simples + packs VIP)
  async createTable(id, data)            { return (await api.post(`/events/${id}/tables`, data)).data.data; },
  async updateTable(id, tableId, data)   { return (await api.patch(`/events/${id}/tables/${tableId}`, data)).data.data; },
  async deleteTable(id, tableId)         { return (await api.delete(`/events/${id}/tables/${tableId}`)).data; },

  // Phase 2 — Bouteilles
  async cartePublic(slug)                { return (await api.get(`/events/${slug}/carte`)).data.data; },
  async listBottles(id)                  { return (await api.get(`/events/${id}/bottles`)).data.data; },
  async createBottle(id, data)           { return (await api.post(`/events/${id}/bottles`, data)).data.data; },
  async updateBottle(id, bId, data)      { return (await api.patch(`/events/${id}/bottles/${bId}`, data)).data.data; },
  async deleteBottle(id, bId)            { return (await api.delete(`/events/${id}/bottles/${bId}`)).data; },

  // Staff
  async listStaff(id)                    { return (await api.get(`/events/${id}/staff`)).data.data; },
  async createStaff(id, data)            { return (await api.post(`/events/${id}/staff`, data)).data.data; },
  async deleteStaff(id, sId)             { return (await api.delete(`/events/${id}/staff/${sId}`)).data; },

  // Promoteurs
  async listPromoters(id)                { return (await api.get(`/events/${id}/promoters`)).data.data; },
  async createPromoter(id, data)         { return (await api.post(`/events/${id}/promoters`, data)).data.data; },
  async deletePromoter(id, pId)          { return (await api.delete(`/events/${id}/promoters/${pId}`)).data; },

  // Dashboard
  async dashboard(id)                    { return (await api.get(`/events/${id}/dashboard`)).data.data; },
};

// Commandes bouteilles + check-in (organisateur via token user, staff via token staff)
export const eventOpsService = {
  async createOrder(data)                        { return (await api.post("/event-orders", data)).data.data; },
  async verifyOrderPin(payload)                  { return (await api.post("/event-orders/verify-pin", payload)).data.data; },
  async listOrders(eventId, auth)                { return (await api.get("/event-orders", { params: { event_id: eventId }, ...authCfg(auth) })).data.data; },
  async setOrderStatus(id, status, auth, eventId){ return (await api.patch(`/event-orders/${id}/status`, { status, event_id: eventId }, authCfg(auth))).data.data; },
  async listCheckin(eventId, auth)               { return (await api.get("/event-checkin", { params: { event_id: eventId }, ...authCfg(auth) })).data.data; },
  async checkin(resaId, undo, auth, eventId, arrivedSize) { return (await api.post(`/event-checkin/${resaId}`, { undo, event_id: eventId, arrived_size: arrivedSize }, authCfg(auth))).data.data; },
  async checkinByRef(ref, auth, eventId, arrivedSize)     { return (await api.post(`/event-checkin/by-ref`, { ref, event_id: eventId, arrived_size: arrivedSize }, authCfg(auth))).data.data; },
  // Phase 3 — interface serveur
  async listServerTables(eventId, auth)          { return (await api.get("/event-server/tables", { params: { event_id: eventId }, ...authCfg(auth) })).data.data; },
  async createServerOrder(data, auth)            { return (await api.post("/event-server/orders", data, authCfg(auth))).data.data; },
};

// Connexion staff (public) → renvoie un token à passer en Authorization
export const eventStaffService = {
  async login(slug, pin)  { return (await api.post("/event-staff/login", { slug, pin })).data.data; },
};

// Passe un token explicite (staff) ; sinon l'intercepteur api ajoute le token user
function authCfg(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export const eventReservationsService = {
  async create(data)            { return (await api.post("/event-reservations", data)).data.data; },
  async createManual(data)      { return (await api.post("/event-reservations/manual", data)).data.data; },
  async listForEvent(eventId)   { return (await api.get("/event-reservations", { params: { event_id: eventId } })).data.data; },
  async listMine()              { return (await api.get("/event-reservations/mine")).data.data; },
  async confirm(id, data = {})  { return (await api.patch(`/event-reservations/${id}/confirm`, data)).data; },
  async resendQr(id)            { return (await api.post(`/event-reservations/${id}/resend-qr`)).data; },
  async cancel(id, reason)      { return (await api.patch(`/event-reservations/${id}/cancel`, reason ? { reason } : {})).data; },
  async getTicket(ref)          { return (await api.get(`/event-reservations/ticket/${encodeURIComponent(ref)}`)).data.data; },
};

export default eventsService;
