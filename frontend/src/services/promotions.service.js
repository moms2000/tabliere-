import api from "./api.js";

// Cadeaux & Jeux : campagnes (admin), validation (restaurateur), mes bons (client).
export const promotionsService = {
  async listCampaigns() {
    return (await api.get("/promotions/campaigns")).data.data; // { campaigns }
  },
  async createCampaign(body) {
    return (await api.post("/promotions/campaigns", body)).data.data; // { campaign }
  },
  async draw(id) {
    return (await api.post(`/promotions/campaigns/${id}/draw`)).data; // { data:{issued,...}, message }
  },
  async winners(id) {
    return (await api.get(`/promotions/campaigns/${id}/winners`)).data.data; // { winners }
  },
  async createGift(body) {
    return (await api.post("/promotions/gifts", body)).data.data; // { voucher, user }
  },
  async validate(code) {
    return (await api.post("/promotions/validate", { code })).data; // { data:{valid,reward_label,client}, message }
  },
  async mine() {
    return (await api.get("/promotions/mine")).data.data; // { vouchers }
  },
};
