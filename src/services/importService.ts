import api from "@/services/api";
import {
  Import,
  ImportedTransaction,
  BatchActionRequest,
  BatchResult,
  AutoApproveRule,
} from "../types/import";
import { CreateTransactionInput } from "../types";

class ImportService {
  async processImport(
    fileUrl: string,
    originalFileName: string,
    paymentMonth?: string,
  ): Promise<Import> {
    const response = await api.post("/api/imports/process", {
      fileUrl,
      originalFileName,
      paymentMonth,
    });
    return response.data;
  }

  async getImports(): Promise<Import[]> {
    const response = await api.get("/api/imports");
    return response.data;
  }

  async getImportedTransactions(
    importId: string
  ): Promise<ImportedTransaction[]> {
    const response = await api.get(`/api/imports/${importId}/transactions`);
    return response.data;
  }

  async approveImportedTransaction(
    transactionId: string,
    data?: CreateTransactionInput
  ): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/approve`, data);
  }

  async mergeImportedTransaction(
    transactionId: string,
    data?: CreateTransactionInput
  ): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/merge`, data);
  }

  async ignoreImportedTransaction(transactionId: string): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/ignore`);
  }

  async deleteImport(importId: string): Promise<void> {
    await api.delete(`/api/imports/${importId}`);
  }

  async deleteImportedTransaction(transactionId: string): Promise<void> {
    await api.delete(`/api/imports/transactions/${transactionId}`);
  }

  async batchAction(request: BatchActionRequest): Promise<BatchResult> {
    const response = await api.post("/api/imports/batch-action", request);
    return response.data;
  }

  async applyAutoApproveRules(importId: string): Promise<BatchResult> {
    const response = await api.post(
      `/api/imports/${importId}/apply-auto-approve-rules`
    );
    return response.data;
  }

  async getAutoApproveRules(): Promise<AutoApproveRule[]> {
    const response = await api.get("/api/imports/auto-approve-rules");
    return response.data;
  }

  async createAutoApproveRule(
    data: Pick<AutoApproveRule, "descriptionPattern" | "categoryId" | "type">
  ): Promise<AutoApproveRule> {
    const response = await api.post("/api/imports/auto-approve-rules", data);
    return response.data;
  }

  async updateAutoApproveRule(
    ruleId: string,
    data: Partial<AutoApproveRule>
  ): Promise<AutoApproveRule> {
    const response = await api.put(
      `/api/imports/auto-approve-rules/${ruleId}`,
      data
    );
    return response.data;
  }

  async deleteAutoApproveRule(ruleId: string): Promise<void> {
    await api.delete(`/api/imports/auto-approve-rules/${ruleId}`);
  }
}

export const importService = new ImportService();
