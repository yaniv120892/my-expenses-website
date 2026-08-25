import { HttpError } from '@/server/http/errors';

// The codes the app branches on, named for what they mean. The raw P-number
// means nothing without the Prisma manual open.
export const PRISMA_ERROR_CODES = {
  RECORD_NOT_FOUND: 'P2025',
  UNIQUE_CONSTRAINT_VIOLATION: 'P2002',
  FOREIGN_KEY_VIOLATION: 'P2003',
  INVALID_IDENTIFIER: 'P2023',
} as const;

type PrismaHttpMapping = { status: number; message: string };

// The recoverable request errors: a client mistake or a lost race, not an
// incident. Codes left unmapped stay 500s and keep alerting.
const PRISMA_HTTP_MAPPINGS: Record<string, PrismaHttpMapping | undefined> = {
  [PRISMA_ERROR_CODES.RECORD_NOT_FOUND]: { status: 404, message: 'Not found' },
  [PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT_VIOLATION]: {
    status: 409,
    message: 'Already exists',
  },
  [PRISMA_ERROR_CODES.FOREIGN_KEY_VIOLATION]: {
    status: 400,
    message: 'Invalid reference',
  },
  [PRISMA_ERROR_CODES.INVALID_IDENTIFIER]: {
    status: 400,
    message: 'Invalid identifier',
  },
};

// Structural rather than instanceof: the Accelerate/edge client bundles its
// own error classes, so identity checks against @prisma/client are unreliable.
export function getPrismaErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}

export function prismaErrorToHttpError(error: unknown): HttpError | undefined {
  const code = getPrismaErrorCode(error);
  const mapping = code ? PRISMA_HTTP_MAPPINGS[code] : undefined;
  return mapping ? new HttpError(mapping.status, mapping.message) : undefined;
}
