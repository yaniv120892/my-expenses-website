// A URL with no explicit port yields '', which would bind a random port and
// leave the app talking to nothing.
function portFrom(url: string | undefined, fallback: number): number {
  if (!url) {
    return fallback;
  }
  return Number(new URL(url).port) || fallback;
}

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

// Null when the app points at a service the harness does not own, so the mock
// cannot fight a real agent for its port.
export const EXTRACTION_MOCK_PORT: number | null = isHarnessOwned(
  process.env.EXCEL_EXTRACTION_AGENT_URL,
)
  ? EXTRACTION_PORT
  : null;
