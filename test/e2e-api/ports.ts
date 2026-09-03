/**
 * Each mock binds the port the app is pointed at, so the harness reads it back
 * out of the URL rather than keeping a second copy of the number. A URL with no
 * explicit port yields '', which would bind a random one and leave the app
 * talking to nothing.
 */
function portFrom(url: string | undefined, fallback: number): number {
  if (!url) {
    return fallback;
  }
  return Number(new URL(url).port) || fallback;
}

// The address the harness serves its own mock on. A URL naming anything else
// is a service the harness does not own.
const EXTRACTION_FALLBACK_URL = 'http://127.0.0.1:51232';
const EXTRACTION_FALLBACK_PORT = Number(new URL(EXTRACTION_FALLBACK_URL).port);

function isHarnessOwned(url: string | undefined): boolean {
  if (!url) {
    return true;
  }
  try {
    return new URL(url).origin === new URL(EXTRACTION_FALLBACK_URL).origin;
  } catch {
    return false;
  }
}

export const MOCK_PORT = portFrom(process.env.ASSISTANT_MODEL_URL, 51231);
export const SHIM_PORT = portFrom(process.env.REDIS_URL, 51230);
export const EXTRACTION_PORT = portFrom(
  process.env.EXCEL_EXTRACTION_AGENT_URL,
  EXTRACTION_FALLBACK_PORT,
);

/**
 * Null when the app is pointed at a service the harness does not own, so the
 * mock cannot fight a real agent for the port it is already serving. Keyed on
 * the origin rather than the port, since a URL with no explicit port falls back
 * to the harness's own and would otherwise look like its own mock.
 */
export const EXTRACTION_MOCK_PORT: number | null = isHarnessOwned(
  process.env.EXCEL_EXTRACTION_AGENT_URL,
)
  ? EXTRACTION_PORT
  : null;
