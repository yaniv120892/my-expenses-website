export type ImportTokenSummary = {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export type CreatedImportToken = ImportTokenSummary & { token: string };
