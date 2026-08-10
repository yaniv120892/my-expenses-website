import http from 'http';

/**
 * An OpenAI-compatible /v1/chat/completions endpoint that returns scripted
 * responses, so the agent loop can be exercised without an API key.
 *
 * Mastra's OpenAI-compatible provider posts to `${baseURL}/chat/completions`.
 *
 * The point is not to simulate a model well — it is to make the agent's
 * behaviour observable. Every request is recorded, so a test can assert which
 * tools the agent invoked and with what arguments, and that the figures it
 * reported came from the tool result rather than from the model.
 */

export interface RecordedToolCall {
  name: string;
  args: unknown;
}

export interface McpRecording {
  requestCount: number;
  toolCalls: RecordedToolCall[];
  toolResults: string[];
  toolsOffered: string[];
}

const emptyRecording = (): McpRecording => ({
  requestCount: 0,
  toolCalls: [],
  toolResults: [],
  toolsOffered: [],
});

// Replaced wholesale rather than cleared field by field, so a new field cannot
// be forgotten here and leak between checks.
let recording = emptyRecording();

export function getRecording(): McpRecording {
  return JSON.parse(JSON.stringify(recording));
}

export function resetRecording(): void {
  recording = emptyRecording();
}

interface ChatMessage {
  role: string;
  content?: unknown;
  tool_calls?: unknown[];
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === 'object' && 'text' in part
          ? String((part as { text: unknown }).text)
          : '',
      )
      .join(' ');
  }
  return '';
}

function sse(res: http.ServerResponse, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function chunk(delta: unknown, finish: string | null): unknown {
  return {
    id: 'chatcmpl-e2e',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'mock',
    choices: [{ index: 0, delta, finish_reason: finish }],
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Gap between streamed chunks. Exported so the incremental-delivery check can
 * assert against the mock's actual pacing instead of a magic number that can
 * drift from it. Comfortably above timer jitter, since deltas may be coalesced
 * downstream and the check then sees only a couple of them.
 */
export const CHUNK_DELAY_MS = 120;

/**
 * Tool-call ids must be unique across the whole conversation, not just within
 * a turn. Memory replays previous turns into each request, so a repeated id
 * collides with the earlier call and its stale result is reused instead of the
 * tool being executed again.
 */
let toolCallSeq = 0;

/**
 * Decides what the "model" does next.
 *
 * First turn: ask for a tool. Second turn (a tool result is present): answer in
 * words, quoting the tool output verbatim so the test can prove the number the
 * user sees originated in TypeScript.
 */
async function respond(
  res: http.ServerResponse,
  messages: ChatMessage[],
): Promise<void> {
  // Only the *last* message decides the turn. Filtering the whole history for
  // tool messages looks equivalent but is not: with memory enabled the thread
  // replays earlier turns' tool results into every request, so the mock would
  // believe a tool had already run and skip straight to answering.
  const last = messages[messages.length - 1];
  const isAfterToolCall = last?.role === 'tool';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const question = textOf(lastUser?.content).toLowerCase();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  if (!isAfterToolCall) {
    const call = pickTool(question);
    recording.toolCalls.push(call);

    sse(
      res,
      chunk(
        {
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: `call_e2e_${++toolCallSeq}`,
              type: 'function',
              function: {
                name: call.name,
                arguments: JSON.stringify(call.args),
              },
            },
          ],
        },
        null,
      ),
    );
    sse(res, chunk({}, 'tool_calls'));
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  if (process.env.E2E_DEBUG_TOOL_MESSAGES) {
    const toolMsgs = messages.filter((m) => m.role === 'tool');
    console.log(
      '[mock] tool messages:',
      JSON.stringify(toolMsgs.map((m) => m.content)).slice(0, 900),
    );
  }

  const toolOutput = textOf(last?.content);
  recording.toolResults.push(toolOutput);

  // Echo the tool output verbatim, in several chunks with gaps, so the test can
  // verify both provenance and that deltas genuinely arrive over time.
  const parts = ['Here is what I found:\n', ...toolOutput.split('\n')];
  for (const part of parts) {
    sse(res, chunk({ content: `${part}\n` }, null));
    await sleep(CHUNK_DELAY_MS);
  }

  sse(res, chunk({}, 'stop'));
  res.write('data: [DONE]\n\n');
  res.end();
}

/** Maps a question to the tool a competent model should choose. */
function pickTool(question: string): RecordedToolCall {
  if (
    question.includes('compare') ||
    question.includes('more than') ||
    question.includes('versus') ||
    question.includes(' vs ')
  ) {
    return {
      name: 'comparePeriods',
      args: {
        periodA: {
          label: 'January',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        periodB: {
          label: 'February',
          startDate: '2026-02-01',
          endDate: '2026-02-28',
        },
        categoryName: 'Groceries',
        transactionType: 'EXPENSE',
      },
    };
  }

  if (question.includes('percentage') || question.includes('category')) {
    return {
      name: 'summarizeTransactions',
      args: {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        transactionType: 'EXPENSE',
        aggregation: 'breakdown_by_category',
      },
    };
  }

  return {
    name: 'summarizeTransactions',
    args: {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      transactionType: 'EXPENSE',
      aggregation: 'total',
    },
  };
}

export function startMockModelServer(port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}');
        recording.requestCount += 1;
        for (const tool of body.tools || []) {
          const name = tool?.function?.name;
          if (name && !recording.toolsOffered.includes(name)) {
            recording.toolsOffered.push(name);
          }
        }
        await respond(res, body.messages || []);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
  });

  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () => resolve(server)),
  );
}
