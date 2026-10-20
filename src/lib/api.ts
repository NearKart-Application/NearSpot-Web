import axios from 'axios';

const _env = (import.meta as Record<string, any>).env ?? {};
const BASE: string =
  _env.API_BASE ||
  _env.PUBLIC_API_BASE ||
  (typeof process !== 'undefined' ? process.env?.API_BASE : undefined) ||
  '/api/v1';

export const api = axios.create({
  baseURL: BASE,
  timeout: 15_000,
  headers: { 'ngrok-skip-browser-warning': 'true' },
});

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
    const original = err.config ?? {};

    // Backend unreachable: no response at all (network/DNS/connection refused) or a
    // gateway/service-unavailable status. Surface the global "Server Unavailable" screen.
    const status = err.response?.status;
    const backendDown = !err.response || status === 502 || status === 503 || status === 504;
    if (backendDown && typeof window !== 'undefined' && !original._nsNoDownScreen) {
      window.dispatchEvent(new CustomEvent('ns:server-unavailable'));
    }

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
            window.dispatchEvent(new CustomEvent('ns:require-login'));
          }
        }
      }
    }
    return Promise.reject(err);
  },
);

export default api;
