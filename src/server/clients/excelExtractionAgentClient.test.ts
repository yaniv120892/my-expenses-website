import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import axios from 'axios';
import { logger } from '@/server/observability';
import { ExcelExtractionAgentClient } from '@/server/clients/excelExtractionAgentClient';

const FILE_NAME = 'Leumi statement March.xlsx';
let post: MockInstance<typeof axios.Axios.prototype.post>;

function submit() {
  return new ExcelExtractionAgentClient().submitExtractionRequest({
    fileUrl: 'https://bucket.s3.us-east-1.amazonaws.com/imports/id.xlsx',
    filename: FILE_NAME,
    userId: 'user-1',
    importId: 'imp-1',
  });
}

function loggedText(): string {
  return JSON.stringify([vi.mocked(logger.info).mock.calls, vi.mocked(logger.error).mock.calls]);
}

beforeEach(() => {
  vi.stubEnv('EXCEL_EXTRACTION_AGENT_URL', 'https://extraction.example.com');
  vi.stubEnv('EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET', 'secret');
  vi.stubEnv('WEBSITE_URL', 'https://expenses.example.com');
  post = vi.spyOn(axios.Axios.prototype, 'post');
  vi.spyOn(logger, 'info');
  vi.spyOn(logger, 'error');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('submitExtractionRequest', () => {
  it('sends the file name but logs only its extension', async () => {
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
});
