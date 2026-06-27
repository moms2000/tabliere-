import api from "./api.js";

export const paymentsService = {
  async initiate(reservationId, method, phone) {
    const res = await api.post("/payments/init", {
      reservation_id: reservationId,
      method,
      phone,
    });
    return res.data.data;
  },

  async checkStatus(paymentId) {
    const res = await api.get(`/payments/status/${paymentId}`);
    return res.data.data;
  },
};
