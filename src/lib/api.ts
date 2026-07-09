import axios from 'axios';

const BASE = (typeof process !== 'undefined' && process.env.API_BASE)
  ? process.env.API_BASE
  : '/api/v1';

export const api = axios.create({ baseURL: BASE, timeout: 15_000 });

// Attach JWT from localStorage on every request
api.interceptors.request.use((cfg) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ns_access');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = typeof window !== 'undefined' ? localStorage.getItem('ns_refresh') : null;
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/auth/token/refresh/`, { refresh });
          localStorage.setItem('ns_access', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ns_access');
            localStorage.removeItem('ns_refresh');
            window.location.href = '/auth/login';
          }
        }
      }
    }
    return Promise.reject(err);
  },
);

export default api;
