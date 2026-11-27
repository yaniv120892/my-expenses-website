import type { MastraModelConfig } from '@mastra/core/llm';
import { DEFAULT_CLAUDE_MODEL } from '@/server/services/ai/claudeService';

type ModelRouterId = `${string}/${string}`;

const DEFAULT_OPENAI_MODEL: ModelRouterId = 'openai/gpt-4o-mini';
const DEFAULT_GEMINI_MODEL: ModelRouterId = 'google/gemini-2.5-flash';
const DEFAULT_CLAUDE_ROUTER_MODEL: ModelRouterId = `anthropic/${DEFAULT_CLAUDE_MODEL}`;

function modelId(fallback: ModelRouterId): ModelRouterId {
  const override = process.env.ASSISTANT_MODEL_ID;
  if (!override) {
    return fallback;
  }
  if (!isModelRouterId(override)) {
    throw new Error(
      `ASSISTANT_MODEL_ID must be "<provider>/<model>" (ASSISTANT_MODEL_ID: ${override})`,
    );
  }
  return override;
}

function isModelRouterId(value: string): value is ModelRouterId {
  return value.includes('/');
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
    case 'claude':
      return {
        id: modelId(DEFAULT_CLAUDE_ROUTER_MODEL),
        apiKey: process.env.ANTHROPIC_API_KEY,
        ...baseUrl,
      };
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
