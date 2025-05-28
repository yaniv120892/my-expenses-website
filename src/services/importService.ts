import api from "@/services/api";
import { Import, ImportFileType, ImportedTransaction } from "../types/import";

class ImportService {
  async processImport(
    fileUrl: string,
    importType: ImportFileType
  ): Promise<Import> {
    const response = await api.post("/api/imports/process", {
      fileUrl,
      importType,
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

  async approveImportedTransaction(transactionId: string): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/approve`);
  }

  async mergeImportedTransaction(transactionId: string): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/merge`);
  }

  async rejectImportedTransaction(transactionId: string): Promise<void> {
    await api.post(`/api/imports/transactions/${transactionId}/reject`);
  }

  async deleteImportedTransaction(transactionId: string): Promise<void> {
    await api.delete(`/api/imports/transactions/${transactionId}`);
  }
}

export const importService = new ImportService();
