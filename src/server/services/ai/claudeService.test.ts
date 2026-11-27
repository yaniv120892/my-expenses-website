import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';
import type { ClientOptions } from '@anthropic-ai/sdk';
import type * as AnthropicModule from '@anthropic-ai/sdk';

const { reportError, anthropicFetch, constructedWith } = vi.hoisted(() => {
  const constructedWith: unknown[] = [];
  return { reportError: vi.fn(), anthropicFetch: vi.fn(), constructedWith };
});

vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof AnthropicModule>();
  class RecordingAnthropic extends actual.default {
    public constructor(options: ClientOptions) {
      constructedWith.push(options);
      super({ ...options, fetch: anthropicFetch });
    }
  }
  return { ...actual, default: RecordingAnthropic };
});
vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));

import { ClaudeService } from '@/server/services/ai/claudeService';
import type { Category } from '@/shared/types/category';

const categories: Category[] = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-rent', name: 'Rent' },
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function messageResponse({
  content,
  stopReason = 'end_turn',
}: {
  content: unknown[];
  stopReason?: string;
}): Response {
  return jsonResponse(200, {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content,
    stop_reason: stopReason,
    stop_details: stopReason === 'refusal' ? { type: 'refusal', category: 'cyber' } : null,
    usage: { input_tokens: 120, output_tokens: 8 },
  });
}

async function sentRequest(): Promise<{ headers: Headers; body: Record<string, unknown> }> {
  const [, init] = anthropicFetch.mock.calls[0] ?? [];
  return {
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  constructedWith.length = 0;
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('CLAUDE_MODEL', '');
});

describe('ClaudeService', () => {
  it('asks Sonnet 5.5 at low effort with server-side fallbacks and no sampling parameters', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({ content: [{ type: 'text', text: 'Food' }] }),
    );

    await new ClaudeService().evaluateCategory('coffee', categories);

    const { headers, body } = await sentRequest();
    expect(body).toMatchObject({
      model: 'claude-sonnet-5-5',
      output_config: { effort: 'low' },
      fallbacks: 'default',
    });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('top_k');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(constructedWith).toEqual([expect.objectContaining({ timeout: 30_000, maxRetries: 1 })]);
  });

  it('reads the category from the text blocks and skips thinking', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({
        content: [
          { type: 'thinking', thinking: 'Rent is monthly', signature: 'sig' },
          { type: 'text', text: ' Rent\n' },
        ],
      }),
    );

    const evaluation = await new ClaudeService().evaluateCategory('apartment', categories);

    expect(evaluation).toMatchObject({ categoryId: 'cat-rent', inputTokens: 120, outputTokens: 8 });
  });

  it('falls back and reports a refusal instead of reading it as an answer', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({ content: [{ type: 'text', text: 'Food' }], stopReason: 'refusal' }),
    );

    await expect(new ClaudeService().suggestCategory('coffee', categories)).resolves.toBeNull();

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Claude declined the request'),
        }),
        where: 'Claude API error',
      }),
    );
  });

  it('uses CLAUDE_MODEL when set', async () => {
    vi.stubEnv('CLAUDE_MODEL', 'claude-opus-5-5');
    anthropicFetch.mockResolvedValue(messageResponse({ content: [{ type: 'text', text: 'ok' }] }));

    await new ClaudeService().generateContent('hello');

    expect((await sentRequest()).body).toMatchObject({ model: 'claude-opus-5-5' });
  });
});
