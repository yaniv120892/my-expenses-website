export function readResetToken(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') || null;
}
