import { optionalEnv } from '@/server/env';

type LogRecord = Record<string, unknown>;

// Vercel Hobby keeps runtime logs for an hour and log drains are Pro-only, so
// records are batched here and shipped from the request's `after` hook.
const MAX_BUFFERED_RECORDS = 100;
const FLUSH_TIMEOUT_MS = 2000;
const WARN_LEVEL = 40;
const ERROR_LEVEL = 50;

const buffer: LogRecord[] = [];
let droppedRecords = 0;
let eagerFlush: Promise<void> | null = null;

interface ShippingConfig {
  url: string;
  token: string;
}

function shippingConfig(): ShippingConfig | null {
  const url = optionalEnv('BETTERSTACK_SOURCE_URL');
  const token = optionalEnv('BETTERSTACK_SOURCE_TOKEN');
  return url && token ? { url, token } : null;
}

function levelOf(record: LogRecord): number {
  return typeof record.level === 'number' ? record.level : 0;
}

// Below warn, only records marked `ship: true` leave, such as a cron's request
// line.
function shouldShip(record: LogRecord): boolean {
  return levelOf(record) >= WARN_LEVEL || record.ship === true;
}

// An error is often followed by the request dying, so it goes out now; guarded
// so a burst costs one batch.
function flushEagerly(): void {
  if (eagerFlush) {
    return;
  }
  eagerFlush = flushRemoteLogs().finally(() => {
    eagerFlush = null;
  });
}

export const betterStackStream = {
  write(line: string): void {
    if (!shippingConfig()) {
      return;
    }
    let record: LogRecord;
    try {
      record = JSON.parse(line) as LogRecord;
    } catch {
      // A record that will not parse is not worth failing a request over.
      return;
    }
    if (!shouldShip(record)) {
      return;
    }
    if (buffer.length >= MAX_BUFFERED_RECORDS) {
      buffer.shift();
      droppedRecords += 1;
    }
    buffer.push(record);
    if (levelOf(record) >= ERROR_LEVEL) {
      flushEagerly();
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
      level: WARN_LEVEL,
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
