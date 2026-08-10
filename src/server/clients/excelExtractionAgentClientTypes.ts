export enum ExcelExtractionRequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ExcelExtractedTransaction {
  date: string; // DD/MM/YYYY format
  description: string;
  value: number;
  type: 'EXPENSE' | 'INCOME';
  rawData?: Record<string, string | number>;
}

export interface ExcelExtractedMetadata {
  creditCardLastFour: string;
  bankSourceType?: 'BANK_CREDIT' | 'NON_BANK_CREDIT' | 'UNKNOWN';
  paymentMonth: string; // MM/YYYY format
  confidence: number;
}

export interface ExcelStructureAnalysis {
  headerRow: number;
  dataStartRow: number;
  columnMappings: {
    date: number;
    description: number;
    amount: number;
  };
  fileType: string;
  confidence: number;
  summary: string;
}

export interface ExcelExtractionResult {
  transactions: ExcelExtractedTransaction[];
  metadata: ExcelExtractedMetadata;
  structure: ExcelStructureAnalysis;
  processingNotes: string[];
  processingTime: number;
}

export interface ExcelExtractionWebhookPayload {
  requestId: string;
  status: 'COMPLETED' | 'FAILED';
  result?: ExcelExtractionResult;
  error?: string;
  completedAt: string;
}

export interface SubmitExtractionRequest {
  fileUrl: string;
  filename: string;
  userId: string;
  options?: {
    confidenceThreshold?: number;
    maxRetries?: number;
    includeRawData?: boolean;
  };
}

export interface ExtractionStatusResponse {
  requestId: string;
  status: ExcelExtractionRequestStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: ExcelExtractionResult;
}

export interface SubmitExtractionResponse {
  success: boolean;
  message: string;
  requestId: string;
  status: ExcelExtractionRequestStatus;
  timestamp: string;
}
