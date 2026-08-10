import axios from 'axios';

// Same-origin API: the httpOnly session cookie rides along automatically.
const api = axios.create();

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login')
    ) {
      window.location.href = '/login?reason=session-expired';
    }
    return Promise.reject(error);
  },
);

export default api;
