import pino from 'pino';
import { betterStackStream } from '@/server/logging/betterStackStream';

declare global {
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
  // Not a pino `transport`: its worker thread is unreliable on Vercel.
  if (remoteShippingEnabled()) {
    return pino(
      { level, base: undefined },
      // Attached at info, not warn: the stream decides what ships, so `ship:
      // true` lines can reach Better Stack.
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
