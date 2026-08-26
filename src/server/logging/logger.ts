import pino from 'pino';
import { betterStackStream } from '@/server/logging/betterStackStream';

declare global {
  // eslint-disable-next-line no-var
  var __logger: pino.Logger | undefined;
}

function remoteShippingEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'development' &&
    Boolean(process.env.BETTERSTACK_SOURCE_URL) &&
    Boolean(process.env.BETTERSTACK_SOURCE_TOKEN)
  );
}

function createLogger(): pino.Logger {
  const level = process.env.LOG_LEVEL ?? 'info';
  // `transport` spawns a worker thread, which is unreliable on Vercel's
  // serverless runtime, so remote shipping goes through multistream instead —
  // and the two options are mutually exclusive in pino anyway.
  if (remoteShippingEnabled()) {
    return pino(
      { level, base: undefined },
      // Attached at info, not warn: the stream itself decides what ships, so a
      // line marked `ship: true` reaches Better Stack without opening the
      // floodgates on every request's info log.
      pino.multistream([
        { stream: process.stdout },
        { stream: betterStackStream, level: 'info' },
      ]),
    );
  }
  return pino({
    level,
    base: undefined,
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}

const logger = (globalThis.__logger ??= createLogger());

export default logger;
