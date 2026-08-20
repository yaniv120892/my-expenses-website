import { optionalEnv } from '@/server/env';

type LogRecord = Record<string, unknown>;

// Vercel Hobby keeps runtime logs for an hour and log drains are Pro-only, so
// warn-and-above records are batched here and shipped by the request's
// `after` hook instead.
const MAX_BUFFERED_RECORDS = 100;
const FLUSH_TIMEOUT_MS = 2000;

const buffer: LogRecord[] = [];
let droppedRecords = 0;

interface ShippingConfig {
  url: string;
  token: string;
}

function shippingConfig(): ShippingConfig | null {
  const url = optionalEnv('BETTERSTACK_SOURCE_URL');
  const token = optionalEnv('BETTERSTACK_SOURCE_TOKEN');
  return url && token ? { url, token } : null;
}

export const betterStackStream = {
  write(line: string): void {
    if (!shippingConfig()) {
      return;
    }
    try {
      const record = JSON.parse(line) as LogRecord;
      if (buffer.length >= MAX_BUFFERED_RECORDS) {
        buffer.shift();
        droppedRecords += 1;
      }
      buffer.push(record);
    } catch {
      // A record that will not parse is not worth failing a request over.
    }
  },
};

export async function flushRemoteLogs(): Promise<void> {
  const config = shippingConfig();
  if (!config || buffer.length === 0) {
    return;
  }

  const batch = buffer.splice(0, buffer.length);
  if (droppedRecords > 0) {
    batch.push({
      level: 40,
      time: Date.now(),
      msg: 'Dropped log records to cap the remote log buffer',
      droppedRecords,
    });
    droppedRecords = 0;
  }

  try {
    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(FLUSH_TIMEOUT_MS),
    });
  } catch {
    // Swallowed deliberately: logging the failure would feed this same buffer
    // and the next flush would fail the same way, forever.
  }
}
