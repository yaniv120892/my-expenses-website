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

export const MOCK_PORT = portFrom(process.env.ASSISTANT_MODEL_URL, 51231);
export const SHIM_PORT = portFrom(process.env.REDIS_URL, 51230);
export const EXTRACTION_PORT = portFrom(
  process.env.EXCEL_EXTRACTION_AGENT_URL,
  51232,
);
