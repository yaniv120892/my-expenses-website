async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? 'Request failed');
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
