import { HttpError } from '@/server/http/errors';

// The codes call sites branch on, named for what they mean — the raw P-number
// means nothing without the Prisma manual open.
export const PRISMA_ERROR_CODES = {
  RECORD_NOT_FOUND: 'P2025',
  UNIQUE_CONSTRAINT_VIOLATION: 'P2002',
} as const;

type PrismaHttpMapping = { status: number; message: string };

// The recoverable request errors: a client mistake or a lost race, not an
// incident. Codes left unmapped stay 500s and keep alerting. This definition
// site keeps the raw codes — the scannable table is the protocol.
const PRISMA_HTTP_MAPPINGS: Record<string, PrismaHttpMapping | undefined> = {
  P2025: { status: 404, message: 'Not found' },
  P2002: { status: 409, message: 'Already exists' },
  P2003: { status: 400, message: 'Invalid reference' },
  P2023: { status: 400, message: 'Invalid identifier' },
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
