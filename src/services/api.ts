import axios from 'axios';
import { z } from 'zod';
import { logout } from './authClient';
import { redirectToSessionExpired } from '@/utils/hardNavigate';

// Same-origin API: the httpOnly session cookie rides along automatically.
const api = axios.create();

// A blob responseType applies to errors too, so their JSON can arrive as a
// Blob. It is parsed once here, so every reader of the body sees an object.
async function parseErrorBody(data: unknown): Promise<unknown> {
  if (!(data instanceof Blob)) {
    return data;
  }
  try {
    const parsed: unknown = JSON.parse(await data.text());
    return parsed;
  } catch {
    return data;
  }
}

const messageBodySchema = z.object({ message: z.string() });

function messageField(body: unknown): string | null {
  return messageBodySchema.safeParse(body).data?.message ?? null;
}

let expiringSession: Promise<void> | null = null;

// The proxy checks only the JWT, so a cookie whose server session is gone
// would bounce /login straight back into the app until it is cleared. Requests
// that 401 together share the one logout and redirect.
function expireSession(): Promise<void> {
  expiringSession ??= logoutAndRedirect();
  return expiringSession;
}

async function logoutAndRedirect(): Promise<void> {
  try {
    await logout();
  } catch {
    // A failed logout must not keep the user on a page whose session is gone.
  }
  redirectToSessionExpired();
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login')
    ) {
      await expireSession();
    }
    if (error.response) {
      error.response.data = await parseErrorBody(error.response.data);
    }
    // Without this every caller reports axios's "Request failed with status
    // code 4xx" instead of the message the server took care to write.
    const message = messageField(error.response?.data);
    if (message) {
      error.message = message;
    }
    return Promise.reject(error);
  },
);

export default api;
