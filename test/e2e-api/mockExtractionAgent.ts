import http from 'http';

/**
 * Stands in for the excel-extraction-service. Accepts a POST /api/extract,
 * answers with a request id, and then calls the webhook URL it was given back
 * with a COMPLETED extraction — the same two-step shape the real service uses.
 *
 * The extracted card digits are derived from the filename (`card-1234.csv` ->
 * `1234`) so a test can upload several files and tell the resulting imports
 * apart, which is the whole point of the multi-file flow.
 */

const CALLBACK_DELAY_MS = 150;

/**
 * Callbacks are delivered one at a time. The local `prisma dev` proxy the e2e
 * runs against intermittently fails a write with a prepared-statement mismatch
 * when two webhooks write concurrently, which is a limitation of that proxy
 * rather than of the app — interleaved callbacks are covered properly in
 * `src/server/webhooks/excelExtractionWebhook.test.ts`.
 */
let callbackChain: Promise<void> = Promise.resolve();

export interface ExtractionRequestRecord {
  fileUrl: string;
  filename: string;
  userId: string;
  webhookUrl: string;
}

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
  return match ? match[1] : '0000';
}

function paymentMonthFromFilename(filename: string): string {
  const match = filename.match(/(\d{2})_(\d{4})/);
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

export function startMockExtractionAgent(port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/api/extract')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const requestId = `mock-req-${++requestCounter}`;

      requests.push({
        fileUrl: parsed.fileUrl,
        filename: parsed.filename,
        userId: parsed.userId,
        webhookUrl: parsed.webhookUrl,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
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
      callbackChain = callbackChain.then(
        () =>
          new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              pendingCallbacks.delete(timer);
              void sendCallback(
                parsed.webhookUrl,
                requestId,
                parsed.filename,
              ).finally(resolve);
            }, CALLBACK_DELAY_MS);
            pendingCallbacks.add(timer);
          }),
      );
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
