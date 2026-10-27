import { describe, expect, it } from 'vitest';
import { HttpError } from '@/server/http/errors';
import {
  getPrismaErrorCode,
  getPrismaErrorModelName,
  prismaErrorToHttpError,
} from '@/server/db/prismaErrors';

describe('getPrismaErrorCode', () => {
  it('reads a P#### code from any object carrying one', () => {
    expect(getPrismaErrorCode({ code: 'P2025' })).toBe('P2025');
  });

  it.each([
    ['a non-Prisma code', { code: 'ECONNRESET' }],
    ['a numeric code', { code: 2025 }],
    ['an object without a code', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'P2025'],
  ])('returns undefined for %s', (_label, error) => {
    expect(getPrismaErrorCode(error)).toBeUndefined();
  });
});

describe('prismaErrorToHttpError', () => {
  it('maps a missing record to a 404', () => {
    const httpError = prismaErrorToHttpError({ code: 'P2025' });

    expect(httpError).toBeInstanceOf(HttpError);
    expect(httpError?.status).toBe(404);
  });

  it('leaves an unmapped code to become a 500', () => {
    expect(prismaErrorToHttpError({ code: 'P1001' })).toBeUndefined();
  });
});

describe('getPrismaErrorModelName', () => {
  it('reads the model a request error names in its meta', () => {
    expect(getPrismaErrorModelName({ code: 'P2025', meta: { modelName: 'Transaction' } })).toBe(
      'Transaction',
    );
  });

  it.each([
    ['an error without meta', new Error('boom')],
    ['meta without a model name', { meta: {} }],
    ['a null meta', { meta: null }],
    ['null', null],
  ])('returns undefined for %s', (_label, error) => {
    expect(getPrismaErrorModelName(error)).toBeUndefined();
  });
});
