import { HttpError } from '@/server/http/errors';

export const PRISMA_ERROR_CODES = {
  RECORD_NOT_FOUND: 'P2025',
  UNIQUE_CONSTRAINT_VIOLATION: 'P2002',
  FOREIGN_KEY_CONSTRAINT_VIOLATION: 'P2003',
} as const;

type PrismaHttpMapping = { status: number; message: string };

// The recoverable request errors. Codes left unmapped stay 500s and keep
// alerting. Keyed by raw code on purpose: this table is the protocol to scan.
const PRISMA_HTTP_MAPPINGS: Record<string, PrismaHttpMapping | undefined> = {
  P2025: { status: 404, message: 'Not found' },
  P2002: { status: 409, message: 'Already exists' },
  P2003: { status: 400, message: 'Invalid reference' },
  P2023: { status: 400, message: 'Invalid identifier' },
};

// Structural rather than instanceof: the error crosses an extended-client
// boundary, where the P#### code is the stable contract.
export function getPrismaErrorCode(error: unknown): string | undefined {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}

export function getPrismaErrorModelName(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('meta' in error)) {
    return undefined;
  }
  const { meta } = error;
  if (typeof meta !== 'object' || meta === null || !('modelName' in meta)) {
    return undefined;
  }
  return meta.modelName;
}

export function prismaErrorToHttpError(error: unknown): HttpError | undefined {
  const code = getPrismaErrorCode(error);
  const mapping = code ? PRISMA_HTTP_MAPPINGS[code] : undefined;
  return mapping ? new HttpError(mapping.status, mapping.message) : undefined;
}
