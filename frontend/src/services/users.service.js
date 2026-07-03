import api from "./api.js";

export const usersService = {
  // ── Favoris (synchro compte) ─────────────────────────────────────────────
  async listFavorites() {
    const res = await api.get("/users/me/favorites");
    return res.data.data?.favorites || [];
  },
  async addFavorite(payload) {
    // payload : { restaurant_id } ou { slug }
    const res = await api.post("/users/me/favorites", payload);
    return res.data.data;
  },
  async removeFavorite(restaurantId) {
    const res = await api.delete(`/users/me/favorites/${restaurantId}`);
    return res.data;
  },

  // ── Fidélité ─────────────────────────────────────────────────────────────
  async loyalty() {
    const res = await api.get("/users/me/loyalty");
    return res.data.data; // { points, honored_visits, points_per_visit }
  },
};

export default usersService;
