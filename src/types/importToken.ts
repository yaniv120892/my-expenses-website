import type {
  CreatedImportToken as SharedCreatedImportToken,
  ImportTokenSummary as SharedImportTokenSummary,
} from '@/shared/types/importToken';

type DateFields = 'createdAt' | 'expiresAt' | 'lastUsedAt';

export type ImportTokenSummary = Omit<SharedImportTokenSummary, DateFields> & {
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export type CreatedImportToken = ImportTokenSummary & {
  token: SharedCreatedImportToken['token'];
};
