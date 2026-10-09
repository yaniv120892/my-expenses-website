export type ImportTokenSummary = {
  id: string;
  name: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
};

export type CreatedImportToken = ImportTokenSummary & { token: string };
