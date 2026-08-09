import pino from 'pino';

declare global {
  // eslint-disable-next-line no-var
  var __logger: pino.Logger | undefined;
}

function createLogger(): pino.Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: undefined,
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}

const logger = (globalThis.__logger ??= createLogger());

export default logger;
