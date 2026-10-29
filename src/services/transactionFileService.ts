import api from './api';

export async function listFiles(transactionId: string) {
  const response = await api.get(`/api/transactions/${transactionId}/attachments`);
  return response.data;
}

export async function attachFile(
  transactionId: string,
  fileMeta: {
    fileKey: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  },
) {
  return api.post(`/api/transactions/${transactionId}/attachments`, fileMeta);
}

export async function removeFile(transactionId: string, fileId: string) {
  await api.delete(`/api/transactions/${transactionId}/attachments/${fileId}`);
}

export async function getPresignedUploadUrl(
  transactionId: string,
  file: { fileName: string; mimeType: string; fileSize: number },
) {
  const response = await api.post(
    `/api/transactions/${transactionId}/attachments/presign-upload`,
    file,
  );
  return response.data;
}
