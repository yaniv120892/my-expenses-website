import {
  decryptStringSync,
  encryptStringSync,
  parseCloakedString,
  parseKeySync,
  type ParsedCloakKey,
} from '@47ng/cloak';
import { Prisma } from '@/generated/prisma/client';

type CardDigitsInput = { creditCardLastFourDigits?: unknown };

// Import.creditCardLastFourDigits is the one column encrypted at rest. Writes
// encrypt it on every Import operation that takes data; reads decrypt it as a
// computed field, so every query returning an Import sees the digits.
export function cardDigitsEncryption(encryptionKey: string) {
  const key = parseKeySync(encryptionKey);
  const encrypt = <Input extends CardDigitsInput>(input: Input): Input =>
    encryptCardDigitsInput(input, key);

  return Prisma.defineExtension({
    name: 'card-digits-encryption',
    query: {
      import: {
        create: ({ args, query }) =>
          query({ ...args, data: encrypt(args.data) }),
        createMany: ({ args, query }) =>
          query({ ...args, data: encryptEach(args.data, encrypt) }),
        createManyAndReturn: ({ args, query }) =>
          query({ ...args, data: encryptEach(args.data, encrypt) }),
        update: ({ args, query }) =>
          query({ ...args, data: encrypt(args.data) }),
        updateMany: ({ args, query }) =>
          query({ ...args, data: encrypt(args.data) }),
        updateManyAndReturn: ({ args, query }) =>
          query({ ...args, data: encrypt(args.data) }),
        upsert: ({ args, query }) =>
          query({
            ...args,
            create: encrypt(args.create),
            update: encrypt(args.update),
          }),
      },
    },
    result: {
      import: {
        creditCardLastFourDigits: {
          needs: { creditCardLastFourDigits: true },
          compute: ({ creditCardLastFourDigits }) =>
            decryptCardDigits(creditCardLastFourDigits, key),
        },
      },
    },
  });
}

export function encryptCardDigitsInput<Input extends CardDigitsInput>(
  input: Input,
  key: ParsedCloakKey,
): Input {
  const digits = input.creditCardLastFourDigits;
  if (typeof digits === 'string') {
    return {
      ...input,
      creditCardLastFourDigits: encryptStringSync(digits, key),
    };
  }
  if (digits !== null && digits !== undefined) {
    throw new Error(
      `creditCardLastFourDigits must be written as a plain string to be encrypted, got ${JSON.stringify(digits)}`,
    );
  }
  return input;
}

// A value that is not a cloak string was never encrypted; it reads back as is.
export function decryptCardDigits(
  stored: string | null,
  key: ParsedCloakKey,
): string | null {
  if (stored === null || !parseCloakedString(stored)) {
    return stored;
  }
  return decryptStringSync(stored, key);
}

function encryptEach<Input extends CardDigitsInput>(
  data: Input | Input[],
  encrypt: (input: Input) => Input,
): Input | Input[] {
  return Array.isArray(data) ? data.map(encrypt) : encrypt(data);
}
