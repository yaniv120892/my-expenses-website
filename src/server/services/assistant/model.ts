import type { MastraModelConfig } from '@mastra/core/llm';

type ModelRouterId = `${string}/${string}`;

const DEFAULT_OPENAI_MODEL: ModelRouterId = 'openai/gpt-4o-mini';
const DEFAULT_GEMINI_MODEL: ModelRouterId = 'google/gemini-2.5-flash';

function modelId(fallback: ModelRouterId): ModelRouterId {
  const override = process.env.ASSISTANT_MODEL_ID;
  return override ? (override as ModelRouterId) : fallback;
}

/**
 * Resolves the assistant model from the same AI_PROVIDER switch used by
 * aiServiceFactory. The API key is passed explicitly so the existing
 * GEMINI_API_KEY name keeps working, and stays a raw optional read — not
 * requireEnv — because the e2e harness points ASSISTANT_MODEL_URL at a mock
 * that needs no real key.
 */
export function getAssistantModel(): MastraModelConfig {
  const provider = process.env.AI_PROVIDER?.toLowerCase();

  // Optional OpenAI-compatible base URL; the e2e tests point this at a mock.
  const url = process.env.ASSISTANT_MODEL_URL;
  const baseUrl = url ? { url } : {};

  switch (provider) {
    case 'gemini':
      return {
        id: modelId(DEFAULT_GEMINI_MODEL),
        apiKey: process.env.GEMINI_API_KEY,
        ...baseUrl,
      };
    case 'chatgpt':
    default:
      return {
        id: modelId(DEFAULT_OPENAI_MODEL),
        apiKey: process.env.OPENAI_API_KEY,
        ...baseUrl,
      };
  }
}
