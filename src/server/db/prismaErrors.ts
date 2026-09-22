import { HttpError } from '@/server/http/errors';

export const PRISMA_ERROR_CODES = {
  RECORD_NOT_FOUND: 'P2025',
  UNIQUE_CONSTRAINT_VIOLATION: 'P2002',
} as const;

type PrismaHttpMapping = { status: number; message: string };

// The recoverable request errors. Codes left unmapped stay 500s and keep
// alerting.
const PRISMA_HTTP_MAPPINGS: Record<string, PrismaHttpMapping | undefined> = {
  P2025: { status: 404, message: 'Not found' },
  P2002: { status: 409, message: 'Already exists' },
  P2003: { status: 400, message: 'Invalid reference' },
  P2023: { status: 400, message: 'Invalid identifier' },
};

// Structural rather than instanceof: the error crosses an extended-client
// boundary, where the P#### code is the stable contract.
export function getPrismaErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}

export function prismaErrorToHttpError(error: unknown): HttpError | undefined {
  const code = getPrismaErrorCode(error);
  const mapping = code ? PRISMA_HTTP_MAPPINGS[code] : undefined;
  return mapping ? new HttpError(mapping.status, mapping.message) : undefined;
}
