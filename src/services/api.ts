import axios from 'axios';

// Same-origin API: the httpOnly session cookie rides along automatically.
const api = axios.create();

// A blob responseType applies to errors too, so their JSON can arrive as a Blob.
async function serverMessage(data: unknown): Promise<string | null> {
  try {
    const body = data instanceof Blob ? JSON.parse(await data.text()) : data;
    return (body as { message?: string })?.message ?? null;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login')
    ) {
      window.location.href = '/login?reason=session-expired';
    }
    // Without this every caller reports axios's "Request failed with status
    // code 4xx" instead of the message the server took care to write.
    const message = await serverMessage(error.response?.data);
    if (message) {
      error.message = message;
    }
    return Promise.reject(error);
  },
);

export default api;
