import axios, { AxiosError } from 'axios';
import logger from '@/server/logging/logger';
import { generateWebhookToken } from '@/server/utils/webhookAuth';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';
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
    this.webhookBaseUrl = requireEnv('WEBSITE_URL');
  }

  async submitExtractionRequest(
    request: SubmitExtractionRequest,
  ): Promise<SubmitExtractionResponse> {
    try {
      const timestamp = Date.now();
      const token = generateWebhookToken(request.userId, timestamp);

      const webhookUrl = `${this.webhookBaseUrl}/api/excel-extraction-agent/webhook?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(request.userId)}&timestamp=${timestamp}`;

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

  async getExtractionStatus(
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

  async checkHealth(): Promise<boolean> {
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
      const axiosError = error as AxiosError;
      return {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
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
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data as
        { message?: string } | undefined;

      if (responseData?.message) {
        return new Error(`${defaultMessage}: ${responseData.message}`);
      }

      if (axiosError.response?.status === 400) {
        return new Error(`${defaultMessage}: Invalid request`);
      }

      if (axiosError.response?.status === 404) {
        return new Error(`${defaultMessage}: Resource not found`);
      }

      if (axiosError.response?.status === 503) {
        return new Error(`${defaultMessage}: Service unavailable`);
      }

      return new Error(
        `${defaultMessage}: ${axiosError.message} (${axiosError.code})`,
      );
    }

    if (error instanceof Error) {
      return new Error(`${defaultMessage}: ${error.message}`);
    }

    return new Error(defaultMessage);
  }
}

const getClient = lazy(() => new ExcelExtractionAgentClient());

// Same surface as the eager instance the Express app exported, but the
// underlying client (and its env reads) is only constructed on first use.
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
