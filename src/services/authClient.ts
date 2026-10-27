// Raw fetch, not the axios client: its 401 interceptor would redirect away from
// these pre-auth flows, whose error bodies carry the message shown to the user.
export class AuthRequestError extends Error {
  public readonly status: number;
  public readonly serverMessage: string | null;

  public constructor({ status, serverMessage }: { status: number; serverMessage: string | null }) {
    super(serverMessage ?? `Auth request failed with status ${status}`);
    this.name = 'AuthRequestError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new AuthRequestError({
      status: response.status,
      serverMessage: data?.error ?? data?.message ?? null,
    });
  }
  return response.json();
}

export async function login(email: string, password: string): Promise<void> {
  await post('/api/auth/login', { email, password });
}

export async function signup(email: string, password: string): Promise<void> {
  await post('/api/auth/signup', { email, username: email, password });
}

export async function verifyCode(code: string, email: string): Promise<void> {
  await post('/api/auth/verify', { code, email });
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}
