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
};

export const eventReservationsService = {
  async create(data)            { return (await api.post("/event-reservations", data)).data.data; },
  async listForEvent(eventId)   { return (await api.get("/event-reservations", { params: { event_id: eventId } })).data.data; },
  async listMine()              { return (await api.get("/event-reservations/mine")).data.data; },
  async confirm(id)             { return (await api.patch(`/event-reservations/${id}/confirm`)).data; },
  async cancel(id)              { return (await api.patch(`/event-reservations/${id}/cancel`)).data; },
};

export default eventsService;
