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

async function send(method: 'POST' | 'PUT', path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method,
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
  await send('POST', '/api/auth/login', { email, password });
}

export async function signup(email: string): Promise<void> {
  await send('POST', '/api/auth/signup', { email, username: email });
}

export async function verifyCode({
  code,
  email,
  password,
}: {
  code: string;
  email: string;
  password: string;
}): Promise<void> {
  await send('POST', '/api/auth/verify', { code, email, password });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await send('POST', '/api/auth/password-reset/request', { email });
}

export async function resetPassword({
  token,
  password,
}: {
  token: string;
  password: string;
}): Promise<void> {
  await send('POST', '/api/auth/password-reset/confirm', { token, password });
}

export async function changePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await send('PUT', '/api/auth/password', { currentPassword, newPassword });
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}
