import type {
  ApiTokenScope,
  ApiTokenSummary as SharedApiTokenSummary,
} from '@/shared/types/apiToken';

export type { ApiTokenScope };

export type ApiTokenSummary = Omit<
  SharedApiTokenSummary,
  'createdAt' | 'expiresAt' | 'lastUsedAt'
> & {
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export type CreatedApiToken = ApiTokenSummary & { token: string };
