import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TransactionFile } from "../types";
import * as TransactionFileService from "../services/transactionFileService";

export const transactionFileKeys = {
  all: ["transactionFiles"] as const,
  list: (transactionId: string) => ["transactionFiles", transactionId] as const,
};

export function useTransactionFilesQuery(transactionId: string) {
  return useQuery<TransactionFile[]>({
    queryKey: transactionFileKeys.list(transactionId),
    queryFn: () => TransactionFileService.listFiles(transactionId),
    enabled: !!transactionId,
  });
}

export function useRemoveFileMutation(transactionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      return TransactionFileService.removeFile(transactionId, fileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionFileKeys.all });
    },
  });
}

export function useTransactionAttachmentUploadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      formData,
      onProgress,
    }: {
      formData: FormData;
      onProgress?: (progress: number) => void;
    }) => {
      return new Promise<{
        fileKey: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/transactions/attachments/upload");
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
              reject(new Error("Invalid server response"));
            }
          } else {
            reject(
              new Error(xhr.responseText || `Upload failed (${xhr.status})`)
            );
          }
        };
        xhr.onerror = () => {
          reject(new Error("Network error during upload"));
        };
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionFileKeys.all });
    },
  });
}

export function useAttachFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactionId,
      fileMeta,
    }: {
      transactionId: string;
      fileMeta: {
        fileKey: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
      };
    }) => {
      return TransactionFileService.attachFile(transactionId, fileMeta);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: transactionFileKeys.list(variables.transactionId),
      });
    },
  });
}
