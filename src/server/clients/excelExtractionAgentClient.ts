import axios from 'axios';
import logger from '@/server/logging/logger';
import { generateWebhookToken } from '@/server/utils/webhookAuth';
import { lazy } from '@/server/lib/lazy';
import { requireEnv, requireSiteUrl } from '@/server/env';
import {
  SubmitExtractionRequest,
  SubmitExtractionResponse,
  ExtractionStatusResponse,
} from '@/server/clients/excelExtractionAgentClientTypes';

export class ExcelExtractionAgentClient {
  private webhookBaseUrl: string;
  private serviceUrl: string;

  constructor() {
    this.serviceUrl = requireEnv('EXCEL_EXTRACTION_AGENT_URL');
    this.webhookBaseUrl = requireSiteUrl();
  }

  public async submitExtractionRequest(
    request: SubmitExtractionRequest,
  ): Promise<SubmitExtractionResponse> {
    try {
      const timestamp = Date.now();
      const token = generateWebhookToken(
        request.userId,
        timestamp,
        request.importId,
      );

      // importId rides along so the callback resolves without waiting for the
      // requestId this call is about to return to be persisted.
      const webhookUrl = `${this.webhookBaseUrl}/api/excel-extraction-agent/webhook?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(request.userId)}&timestamp=${timestamp}&importId=${encodeURIComponent(request.importId)}`;

      const payload = {
        fileUrl: request.fileUrl,
        filename: request.filename,
        userId: request.userId,
        webhookUrl,
        options: request.options || {
          confidenceThreshold: 0.7,
          maxRetries: 3,
          includeRawData: false,
        },
      };

      logger.info(
        {
          filename: request.filename,
          userId: request.userId,
          fileUrl: request.fileUrl.substring(0, 100),
          webhookUrlPreview: this.webhookBaseUrl,
        },
        'Submitting extraction request',
      );

      const client = axios.create({
        baseURL: this.serviceUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await client.post<SubmitExtractionResponse>(
        '/api/extract',
        payload,
      );

      logger.info(
        {
          requestId: response.data.requestId,
          status: response.data.status,
          userId: request.userId,
        },
        'Extraction request submitted successfully',
      );

      return response.data;
    } catch (error) {
      logger.error(
        {
          err: this.formatError(error),
          filename: request.filename,
          userId: request.userId,
        },
        'Failed to submit extraction request',
      );

      throw this.handleError(error, 'Failed to submit extraction request');
    }
  }

  public async getExtractionStatus(
    requestId: string,
  ): Promise<ExtractionStatusResponse> {
    try {
      logger.debug({ requestId }, 'Fetching extraction status');

      const client = axios.create({
        baseURL: this.serviceUrl,
        timeout: 5000,
      });

      const response = await client.get<ExtractionStatusResponse>(
        `/api/status/${requestId}`,
      );

      logger.debug(
        { requestId, status: response.data.status },
        'Extraction status retrieved',
      );

      return response.data;
    } catch (error) {
      logger.error(
        { err: this.formatError(error), requestId },
        'Failed to get extraction status',
      );

      throw this.handleError(error, 'Failed to get extraction status');
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const client = axios.create({
        baseURL: this.serviceUrl,
        timeout: 5000,
      });

      const response = await client.get('/api/health');

      const isHealthy = response.status === 200;
      logger.debug(
        { healthy: isHealthy, status: response.status },
        'Excel extraction service health check',
      );

      return isHealthy;
    } catch (error) {
      logger.warn(
        { err: this.formatError(error) },
        'Excel extraction service health check failed',
      );
      return false;
    }
  }

  private formatError(error: unknown): unknown {
    if (axios.isAxiosError(error)) {
      return {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }

    return error;
  }

  private handleError(error: unknown, defaultMessage: string): Error {
    // The type argument is what makes `response.data` typed rather than `any`,
    // so the message lookup below needs no cast.
    if (axios.isAxiosError<{ message?: string }>(error)) {
      if (error.response?.data?.message) {
        return new Error(`${defaultMessage}: ${error.response.data.message}`);
      }

      if (error.response?.status === 400) {
        return new Error(`${defaultMessage}: Invalid request`);
      }

      if (error.response?.status === 404) {
        return new Error(`${defaultMessage}: Resource not found`);
      }

      if (error.response?.status === 503) {
        return new Error(`${defaultMessage}: Service unavailable`);
      }

      return new Error(`${defaultMessage}: ${error.message} (${error.code})`);
    }

    if (error instanceof Error) {
      return new Error(`${defaultMessage}: ${error.message}`);
    }

    return new Error(defaultMessage);
  }
}

const getClient = lazy(() => new ExcelExtractionAgentClient());

export const excelExtractionAgentClient = {
  submitExtractionRequest(
    request: SubmitExtractionRequest,
  ): Promise<SubmitExtractionResponse> {
    return getClient().submitExtractionRequest(request);
  },
  getExtractionStatus(requestId: string): Promise<ExtractionStatusResponse> {
    return getClient().getExtractionStatus(requestId);
  },
  checkHealth(): Promise<boolean> {
    return getClient().checkHealth();
  },
};
