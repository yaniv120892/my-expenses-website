export type ImportTokenSummary = {
  id: string;
  name: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
};

// The only time the plaintext leaves the server; it is not stored.
export type CreatedImportToken = ImportTokenSummary & { token: string };
