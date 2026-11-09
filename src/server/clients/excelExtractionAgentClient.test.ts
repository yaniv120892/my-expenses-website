import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import axios from 'axios';
import { logger } from '@/server/observability';
import { ExcelExtractionAgentClient } from '@/server/clients/excelExtractionAgentClient';

const FILE_NAME = 'Leumi statement March.xlsx';
let post: MockInstance<typeof axios.Axios.prototype.post>;

function submit() {
  return new ExcelExtractionAgentClient().submitExtractionRequest({
    fileUrl: 'https://bucket.s3.us-east-1.amazonaws.com/imports/uuid-Leumi_statement_March.xlsx',
    filename: FILE_NAME,
    userId: 'user-1',
    importId: 'imp-1',
  });
}

function sentHeaders(): unknown {
  const instance = post.mock.contexts[0];
  return instance instanceof axios.Axios ? instance.defaults.headers : undefined;
}

function loggedText(): string {
  return JSON.stringify([vi.mocked(logger.info).mock.calls, vi.mocked(logger.error).mock.calls]);
}

beforeEach(() => {
  vi.stubEnv('EXCEL_EXTRACTION_AGENT_URL', 'https://extraction.example.com');
  vi.stubEnv('EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET', 'secret');
  vi.stubEnv('EXCEL_EXTRACTION_AGENT_API_SECRET', 'service-secret');
  vi.stubEnv('WEBSITE_URL', 'https://expenses.example.com');
  post = vi.spyOn(axios.Axios.prototype, 'post');
  vi.spyOn(logger, 'info');
  vi.spyOn(logger, 'error');
  vi.spyOn(logger, 'warn');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('submitExtractionRequest', () => {
  it('sends the file name but logs only its extension, even from an older name-bearing key', async () => {
    post.mockResolvedValue({ data: { requestId: 'req-1', status: 'PENDING' } });

    await submit();

    expect(post).toHaveBeenCalledWith(
      '/api/extract',
      expect.objectContaining({ filename: FILE_NAME }),
    );
    expect(loggedText()).not.toMatch(/Leumi|statement|March/);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ importId: 'imp-1', fileExtension: '.xlsx' }),
      'Submitting extraction request',
    );
  });

  it('keeps the file name out of the failure log', async () => {
    post.mockRejectedValue(new Error('agent down'));

    await expect(submit()).rejects.toThrow();

    expect(loggedText()).not.toMatch(/Leumi|statement|March/);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ importId: 'imp-1' }),
      'Failed to submit extraction request',
    );
  });

  it('authenticates to the service with the shared secret as a bearer token', async () => {
    post.mockResolvedValue({ data: { requestId: 'req-1', status: 'PENDING' } });

    await submit();

    expect(sentHeaders()).toMatchObject({ Authorization: 'Bearer service-secret' });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('still submits, without a token and with a warning, while the secret is unset', async () => {
    vi.stubEnv('EXCEL_EXTRACTION_AGENT_API_SECRET', '');
    post.mockResolvedValue({ data: { requestId: 'req-1', status: 'PENDING' } });

    await expect(submit()).resolves.toMatchObject({ requestId: 'req-1' });

    expect(sentHeaders()).toMatchObject({ 'Content-Type': 'application/json' });
    expect(sentHeaders()).not.toHaveProperty('Authorization');
    expect(logger.warn).toHaveBeenCalledWith(
      { envVar: 'EXCEL_EXTRACTION_AGENT_API_SECRET' },
      'Extraction service secret unset; calling it without authentication',
    );
  });
});
