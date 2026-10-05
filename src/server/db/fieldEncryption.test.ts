import { describe, expect, it } from 'vitest';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import fieldEncryptionDmmf from '@/generated/field-encryption/dmmf.json';

// CI's test-only key, and a value it encrypted under Prisma 6 (the same pair
// test/e2e-api/run.ts reads back from a real row).
const TEST_KEY = 'k1.aesgcm256.oAsfUHjnw25v7kaFzQXGAG24LEhRlt8Ow6cjjc5s3bE=';
const CIPHERTEXT_FROM_PRISMA_6 =
  'v1.aesgcm256.1afd1481.47kmaZqf2lRXEpoN.C-7BS5kwYYLa1Ybv5a8j4DGS7iY=';
const DIGITS_BEHIND_THAT_CIPHERTEXT = '9322';

type QueryParams = {
  model: string;
  operation: string;
  args: { data?: Record<string, unknown>; where?: Record<string, unknown> };
  query: (args: QueryParams['args']) => Promise<unknown>;
};
type AllOperations = (params: QueryParams) => Promise<unknown>;
type QueryExtension = {
  query: { $allModels: { $allOperations: AllOperations } };
};

describe('field encryption on the generated client', () => {
  it('encrypts Import.creditCardLastFourDigits on write and decrypts the result', async () => {
    let written: QueryParams['args'] = {};
    const result = await allOperations()({
      model: 'Import',
      operation: 'create',
      args: { data: { creditCardLastFourDigits: '1234' } },
      // A copy, as a database returns: the extension hands over frozen args.
      query: async (args) => {
        written = args;
        return { ...args.data };
      },
    });

    expect(written.data?.creditCardLastFourDigits).toMatch(/^v1\.aesgcm256\./);
    expect(result).toEqual({ creditCardLastFourDigits: '1234' });
  });

  it('decrypts a value stored before the move to Prisma 7', async () => {
    const result = await allOperations()({
      model: 'Import',
      operation: 'findUnique',
      args: { where: { id: 'import-id' } },
      query: async () => ({
        creditCardLastFourDigits: CIPHERTEXT_FROM_PRISMA_6,
      }),
    });

    expect(result).toEqual({
      creditCardLastFourDigits: DIGITS_BEHIND_THAT_CIPHERTEXT,
    });
  });

  it('leaves fields without the annotation as they are', async () => {
    let written: QueryParams['args'] = {};
    await allOperations()({
      model: 'Import',
      operation: 'create',
      args: { data: { originalFileName: 'card-1234_03_2026.csv' } },
      query: async (args) => {
        written = args;
        return args.data;
      },
    });

    expect(written.data?.originalFileName).toBe('card-1234_03_2026.csv');
  });
});

// The extension is a function of the client it extends; handing it a stand-in
// `$extends` exposes the query hook it would install.
function allOperations(): AllOperations {
  const extension = fieldEncryptionExtension({
    encryptionKey: TEST_KEY,
    dmmf: fieldEncryptionDmmf,
  });
  let definition: unknown;
  extension({
    $extends: (extensionDefinition: unknown) => {
      definition = extensionDefinition;
    },
  });
  if (!isQueryExtension(definition)) {
    throw new Error('prisma-field-encryption installed no query extension');
  }
  return definition.query.$allModels.$allOperations;
}

function isQueryExtension(value: unknown): value is QueryExtension {
  return typeof value === 'object' && value !== null && 'query' in value;
}
