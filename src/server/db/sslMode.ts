// pg 8 already verifies the certificate for these modes and warns that pg 9
// will not; naming verify-full keeps today's check and silences the warning.
// Under uselibpqcompat=true pg follows libpq instead, so the mode is left alone.
const MODES_PG_VERIFIES_FULLY = new Set(['prefer', 'require', 'verify-ca']);

export function withVerifyFullSslMode(connectionString: string): string {
  if (!URL.canParse(connectionString)) {
    return connectionString;
  }
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');
  if (
    sslMode === null ||
    !MODES_PG_VERIFIES_FULLY.has(sslMode) ||
    url.searchParams.get('uselibpqcompat') === 'true'
  ) {
    return connectionString;
  }
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
