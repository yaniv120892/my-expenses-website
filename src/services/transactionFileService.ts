import api from "./api";

export async function listFiles(transactionId: string) {
  const res = await api.get(`/api/transactions/${transactionId}/attachments`);
  return res.data;
}

export async function attachFile(
  transactionId: string,
  fileMeta: {
    fileKey: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }
) {
  return api.post(`/api/transactions/${transactionId}/attachments`, fileMeta);
}

export async function removeFile(transactionId: string, fileId: string) {
  await api.delete(`/api/transactions/${transactionId}/attachments/${fileId}`);
}
