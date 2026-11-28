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
import { FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT } from '@/server/services/ai/prompts';
import { importedCharge, matchCandidate } from '@/test/aiMatchFixtures';
import type { Category } from '@/shared/types/category';

const categories: Category[] = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-rent', name: 'Rent' },
];

function messageResponse({
  content,
  stopReason = 'end_turn',
}: {
  content: unknown[];
  stopReason?: string;
}): Response {
  return Response.json({
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

function sentRequest(): { headers: Headers; body: Record<string, unknown> } {
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

    const { headers, body } = sentRequest();
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

  it('falls back and reports a max_tokens stop that left no answer', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({
        content: [{ type: 'thinking', thinking: 'Rent or food…', signature: 'sig' }],
        stopReason: 'max_tokens',
      }),
    );

    await expect(new ClaudeService().analyzeExpenses('summary')).resolves.toBeNull();

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Claude hit max_tokens before answering'),
        }),
      }),
    );
  });

  it('keeps a max_tokens answer that did reach the text', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({
        content: [{ type: 'text', text: 'Spending rose' }],
        stopReason: 'max_tokens',
      }),
    );

    await expect(new ClaudeService().analyzeExpenses('summary')).resolves.toBe('Spending rose');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reads an analysis split across text blocks as one continuous text', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({
        content: [
          { type: 'text', text: 'You spent ' },
          { type: 'text', text: 'more on food.' },
        ],
      }),
    );

    await expect(new ClaudeService().analyzeExpenses('summary')).resolves.toBe(
      'You spent more on food.',
    );
  });

  it('reads an empty analysis as no analysis', async () => {
    anthropicFetch.mockResolvedValue(messageResponse({ content: [{ type: 'text', text: '  ' }] }));

    await expect(new ClaudeService().analyzeExpenses('summary')).resolves.toBeNull();
  });

  it('reads empty generated content as no content', async () => {
    anthropicFetch.mockResolvedValue(messageResponse({ content: [{ type: 'text', text: '  ' }] }));

    await expect(new ClaudeService().generateContent('advise me')).resolves.toBeNull();
  });

  it('falls back to null and reports a refused content request', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({ content: [{ type: 'text', text: 'No.' }], stopReason: 'refusal' }),
    );

    await expect(new ClaudeService().generateContent('advise me')).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        where: 'Claude API error',
        context: expect.objectContaining({ operation: 'generateContent' }),
      }),
    );
  });

  it('makes no call when there is nothing to match against', async () => {
    await expect(
      new ClaudeService().findMatchingTransaction(importedCharge, []),
    ).resolves.toBeNull();
    expect(anthropicFetch).not.toHaveBeenCalled();
  });

  it('returns the offered match the model names', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({ content: [{ type: 'text', text: matchCandidate.id }] }),
    );

    await expect(
      new ClaudeService().findMatchingTransaction(importedCharge, [matchCandidate]),
    ).resolves.toBe(matchCandidate.id);
    expect(sentRequest().body).toMatchObject({ system: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT });
  });

  it('keeps the match when the explanation and the id come in separate text blocks', async () => {
    anthropicFetch.mockResolvedValue(
      messageResponse({
        content: [
          { type: 'text', text: 'The merchant and the amount match.' },
          { type: 'text', text: matchCandidate.id },
        ],
      }),
    );

    await expect(
      new ClaudeService().findMatchingTransaction(importedCharge, [matchCandidate]),
    ).resolves.toBe(matchCandidate.id);
  });

  it('uses CLAUDE_MODEL when set', async () => {
    vi.stubEnv('CLAUDE_MODEL', 'claude-opus-5-5');
    anthropicFetch.mockResolvedValue(messageResponse({ content: [{ type: 'text', text: 'ok' }] }));

    await new ClaudeService().generateContent('hello');

    const { body } = sentRequest();
    expect(body).toMatchObject({ model: 'claude-opus-5-5' });
    expect(body).not.toHaveProperty('system');
  });
});
