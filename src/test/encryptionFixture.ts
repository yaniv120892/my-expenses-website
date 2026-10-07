// CI's test-only PRISMA_FIELD_ENCRYPTION_KEY, and a value it encrypted under an
// earlier Prisma client. Only a read of this pair fails when the ciphertext
// format or the key changes under rows already stored.
export const TEST_ENCRYPTION_KEY =
  'k1.aesgcm256.oAsfUHjnw25v7kaFzQXGAG24LEhRlt8Ow6cjjc5s3bE=';
export const CIPHERTEXT_FROM_AN_EARLIER_CLIENT =
  'v1.aesgcm256.1afd1481.47kmaZqf2lRXEpoN.C-7BS5kwYYLa1Ybv5a8j4DGS7iY=';
export const DIGITS_BEHIND_THAT_CIPHERTEXT = '9322';
