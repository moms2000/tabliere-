import api from "./api.js";

export const storiesService = {
  async list(slug)          { return (await api.get(`/stories/${slug}`)).data.data; },
  async create(slug, photo) { return (await api.post(`/stories`, { slug, photo })).data.data; },
  async remove(id)          { return (await api.delete(`/stories/${id}`)).data; },
  async react(id, emoji)    { return (await api.post(`/stories/${id}/react`, { emoji })).data; },
  async unreact(id)         { return (await api.delete(`/stories/${id}/react`)).data; },
  async hide(id)            { return (await api.post(`/stories/${id}/hide`)).data; },
};

export default storiesService;
