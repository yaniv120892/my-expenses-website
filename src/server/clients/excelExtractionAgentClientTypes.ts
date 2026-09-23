export enum ExcelExtractionRequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface SubmitExtractionRequest {
  fileUrl: string;
  filename: string;
  userId: string;
  importId: string;
  options?: {
    confidenceThreshold?: number;
    maxRetries?: number;
    includeRawData?: boolean;
  };
}

export interface SubmitExtractionResponse {
  success: boolean;
  message: string;
  requestId: string;
  status: ExcelExtractionRequestStatus;
  timestamp: string;
}
