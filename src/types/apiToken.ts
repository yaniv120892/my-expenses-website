import type { ApiTokenScope } from '@/shared/types/apiToken';

export type { ApiTokenScope };

export type ApiTokenSummary = {
  id: string;
  name: string;
  scopes: ApiTokenScope[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export type CreatedApiToken = ApiTokenSummary & { token: string };
