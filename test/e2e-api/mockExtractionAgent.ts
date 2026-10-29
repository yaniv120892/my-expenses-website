import http from 'http';

// Card digits come from the filename (`card-1234.csv` -> `1234`), so a test can
// tell apart the imports several uploads became.

const CALLBACK_DELAY_MS = 150;

// Callbacks go one at a time: the local `prisma dev` proxy intermittently fails
// concurrent webhook writes on a prepared-statement mismatch, a proxy
// limitation.
let callbackChain: Promise<void> = Promise.resolve();

export type ExtractionRequestRecord = {
  fileUrl: string;
  filename: string;
  userId: string;
  webhookUrl: string;
};

let requests: ExtractionRequestRecord[] = [];
let requestCounter = 0;
// Tracked so a pending callback cannot outlive the server and keep the
// process alive after the stack shuts down.
const pendingCallbacks = new Set<NodeJS.Timeout>();

export function getExtractionRequests(): ExtractionRequestRecord[] {
  return requests.map((request) => ({ ...request }));
}

export function resetExtractionRequests(): void {
  requests = [];
  requestCounter = 0;
}

function cardDigitsFromFilename(filename: string): string {
  const match = filename.match(/(\d{4})/);
  return match?.[1] ?? '0000';
}

function paymentMonthFromFilename(filename: string): string {
  const match = filename.match(/(\d{2})[-_](\d{4})/);
  return match ? `${match[1]}/${match[2]}` : '03/2026';
}

function buildCompletedPayload(requestId: string, filename: string) {
  return {
    requestId,
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    result: {
      transactions: [
        {
          date: '07/03/2026',
          description: `Coffee ${cardDigitsFromFilename(filename)}`,
          value: 12.5,
          type: 'EXPENSE',
        },
      ],
      metadata: {
        creditCardLastFour: cardDigitsFromFilename(filename),
        bankSourceType: 'BANK_CREDIT',
        paymentMonth: paymentMonthFromFilename(filename),
        confidence: 0.9,
      },
      structure: {
        headerRow: 0,
        dataStartRow: 1,
        columnMappings: { date: 0, description: 1, amount: 2 },
        fileType: 'CSV',
        confidence: 0.9,
        summary: 'mock',
      },
      processingNotes: [],
      processingTime: 1,
    },
  };
}

async function sendCallback(
  webhookUrl: string,
  requestId: string,
  filename: string,
): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCompletedPayload(requestId, filename)),
    });
  } catch (error) {
    console.error('mock extraction callback failed', error);
  }
}

// Callbacks go out one at a time, each CALLBACK_DELAY_MS after the previous one settled. A timer
// cleared on server close never fires, so its callback is never sent.
async function sendCallbackAfter({
  previous,
  webhookUrl,
  requestId,
  filename,
}: {
  previous: Promise<void>;
  webhookUrl: string;
  requestId: string;
  filename: string;
}): Promise<void> {
  await previous;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      pendingCallbacks.delete(timer);
      resolve();
    }, CALLBACK_DELAY_MS);
    pendingCallbacks.add(timer);
  });
  await sendCallback(webhookUrl, requestId, filename);
}

export function startMockExtractionAgent(port: number): Promise<http.Server> {
  const server = http.createServer((request, response) => {
    if (request.method !== 'POST' || !request.url?.startsWith('/api/extract')) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const requestId = `mock-request-${++requestCounter}`;

      requests.push({
        fileUrl: parsed.fileUrl,
        filename: parsed.filename,
        userId: parsed.userId,
        webhookUrl: parsed.webhookUrl,
      });

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          success: true,
          message: 'accepted',
          requestId,
          status: 'PENDING',
          timestamp: new Date().toISOString(),
        }),
      );

      // Deliberately after the response, so the callback races the caller
      // persisting the request id — exactly the window the importId in the
      // webhook URL exists to close.
      callbackChain = sendCallbackAfter({
        previous: callbackChain,
        webhookUrl: parsed.webhookUrl,
        requestId,
        filename: parsed.filename,
      });
    });
  });

  server.on('close', () => {
    pendingCallbacks.forEach(clearTimeout);
    pendingCallbacks.clear();
    callbackChain = Promise.resolve();
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
