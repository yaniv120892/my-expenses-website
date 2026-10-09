export const API_TOKEN_SCOPES = ['IMPORTS'] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export type ApiTokenSummary = {
  id: string;
  name: string;
  scopes: ApiTokenScope[];
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
};

// The only time the plaintext leaves the server; it is not stored.
export type CreatedApiToken = ApiTokenSummary & { token: string };
