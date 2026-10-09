import api from './api';
import type {
  CreatedImportToken,
  ImportTokenSummary,
} from '@/types/importToken';

export async function getImportTokens(): Promise<ImportTokenSummary[]> {
  const response = await api.get('/api/import-tokens');
  return response.data;
}

export async function createImportToken(
  name: string,
): Promise<CreatedImportToken> {
  const response = await api.post('/api/import-tokens', { name });
  return response.data;
}

export async function revokeImportToken(tokenId: string): Promise<void> {
  await api.delete(`/api/import-tokens/${tokenId}`);
}
