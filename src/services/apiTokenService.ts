import api from './api';
import type {
  ApiTokenScope,
  ApiTokenSummary,
  CreatedApiToken,
} from '@/types/apiToken';

export async function getApiTokens(): Promise<ApiTokenSummary[]> {
  const response = await api.get('/api/api-tokens');
  return response.data;
}

export async function createApiToken(input: {
  name: string;
  scopes: ApiTokenScope[];
}): Promise<CreatedApiToken> {
  const response = await api.post('/api/api-tokens', input);
  return response.data;
}

export async function revokeApiToken(tokenId: string): Promise<void> {
  await api.delete(`/api/api-tokens/${tokenId}`);
}
