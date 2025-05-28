import api from "@/services/api";
import { Import, ImportFileType, ImportedTransaction } from "../types/import";
import { CreateTransactionInput } from "../types";

class ImportService {
  async processImport(
    fileUrl: string,
    importType: ImportFileType,
    originalFileName: string,
  ): Promise<Import> {
    const response = await api.post("/api/imports/process", {
      fileUrl,
      importType,
      originalFileName,
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

  async deleteImportedTransaction(transactionId: string): Promise<void> {
    await api.delete(`/api/imports/transactions/${transactionId}`);
  }
}

export const importService = new ImportService();
