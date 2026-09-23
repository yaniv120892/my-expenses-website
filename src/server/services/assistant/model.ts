import type { MastraModelConfig } from '@mastra/core/llm';

type ModelRouterId = `${string}/${string}`;

const DEFAULT_OPENAI_MODEL: ModelRouterId = 'openai/gpt-4o-mini';
const DEFAULT_GEMINI_MODEL: ModelRouterId = 'google/gemini-2.5-flash';

function modelId(fallback: ModelRouterId): ModelRouterId {
  const override = process.env.ASSISTANT_MODEL_ID;
  return override ? (override as ModelRouterId) : fallback;
}

/**
 * The key is passed explicitly so the GEMINI_API_KEY name keeps working, and
 * read optionally rather than via requireEnv because the e2e mock at
 * ASSISTANT_MODEL_URL needs no key.
 */
export function getAssistantModel(): MastraModelConfig {
  const provider = process.env.AI_PROVIDER?.toLowerCase();

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
