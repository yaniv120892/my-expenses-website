// pg 8 already verifies the certificate for these modes and warns that pg 9
// will not; naming verify-full keeps today's check and silences the warning.
const MODES_PG_VERIFIES_FULLY = ['prefer', 'require'];

export function withVerifyFullSslMode(connectionString: string): string {
  if (!URL.canParse(connectionString)) {
    return connectionString;
  }
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');
  if (!sslMode || !MODES_PG_VERIFIES_FULLY.includes(sslMode)) {
    return connectionString;
  }
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
