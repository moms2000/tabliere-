import api from "./api.js";

// Gestion du staff restaurant (côté restaurateur propriétaire)
export const restaurantStaffService = {
  async list() {
    return (await api.get("/restaurant-staff")).data.data; // { staff:[], tabs:[] }
  },
  async create(data) {
    return (await api.post("/restaurant-staff", data)).data.data; // { staff }
  },
  async update(id, data) {
    return (await api.patch(`/restaurant-staff/${id}`, data)).data.data;
  },
  async remove(id) {
    return (await api.delete(`/restaurant-staff/${id}`)).data;
  },
};
