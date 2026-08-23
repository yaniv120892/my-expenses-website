import api from '@/services/api';
import {
  Import,
  ImportedTransaction,
  BatchActionRequest,
  BatchResult,
  AutoApproveRule,
} from '../types/import';
import { CreateTransactionInput } from '../types';

const UPLOAD_TIMEOUT_MS = 120000;

class ImportService {
  // XMLHttpRequest instead of axios/fetch for upload progress events.
  public uploadImportFile(
    formData: FormData,
    onProgress?: (progress: number) => void,
  ): Promise<{ fileUrl: string }> {
    return new Promise<{ fileUrl: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/imports/upload');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Invalid server response'));
          }
        } else {
          reject(
            new Error(xhr.responseText || `Upload failed (${xhr.status})`),
          );
        }
      };
      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.ontimeout = () => {
        reject(
          new Error(
            'Upload timed out — please check your connection and try again',
          ),
        );
      };
      xhr.send(formData);
    });
  }

  public async processImport(
    fileUrl: string,
    originalFileName: string,
    paymentMonth?: string,
  ): Promise<Import> {
    const response = await api.post('/api/imports/process', {
      fileUrl,
      originalFileName,
      paymentMonth,
    });
    return response.data;
  }

  public async getImports(): Promise<Import[]> {
    const response = await api.get('/api/imports');
    return response.data;
  }

  public async getImportedTransactions(
    importId: string,
  ): Promise<ImportedTransaction[]> {
    const response = await api.get(`/api/imports/${importId}/transactions`);
    return response.data;
  }

  public async approveImportedTransaction(
    transactionId: string,
    data?: CreateTransactionInput,
  ): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/approve`, data);
  }

  public async mergeImportedTransaction(
    transactionId: string,
    data?: CreateTransactionInput,
  ): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/merge`, data);
  }

  public async ignoreImportedTransaction(transactionId: string): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/ignore`);
  }

  public async deleteImport(importId: string): Promise<void> {
    await api.delete(`/api/imports/${importId}`);
  }

  public async deleteImportedTransaction(transactionId: string): Promise<void> {
    await api.delete(`/api/imports/transactions/${transactionId}`);
  }

  public async batchAction(request: BatchActionRequest): Promise<BatchResult> {
    const response = await api.post('/api/imports/batch-action', request);
    return response.data;
  }

  public async applyAutoApproveRules(importId: string): Promise<BatchResult> {
    const response = await api.post(
      `/api/imports/${importId}/apply-auto-approve-rules`,
    );
    return response.data;
  }

  public async rematchImport(importId: string): Promise<void> {
    await api.post(`/api/imports/${importId}/rematch`);
  }

  public async getAutoApproveRules(): Promise<AutoApproveRule[]> {
    const response = await api.get('/api/imports/auto-approve-rules');
    return response.data;
  }

  public async createAutoApproveRule(
    data: Pick<AutoApproveRule, 'descriptionPattern' | 'categoryId' | 'type'>,
  ): Promise<AutoApproveRule> {
    const response = await api.post('/api/imports/auto-approve-rules', data);
    return response.data;
  }

  public async updateAutoApproveRule(
    ruleId: string,
    data: Partial<AutoApproveRule>,
  ): Promise<AutoApproveRule> {
    const response = await api.put(
      `/api/imports/auto-approve-rules/${ruleId}`,
      data,
    );
    return response.data;
  }

  public async deleteAutoApproveRule(ruleId: string): Promise<void> {
    await api.delete(`/api/imports/auto-approve-rules/${ruleId}`);
  }
}

export const importService = new ImportService();
