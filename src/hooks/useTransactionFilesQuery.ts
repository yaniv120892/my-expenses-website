import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TransactionFile } from "../types";
import * as TransactionFileService from "../services/transactionFileService";
import { useState } from "react";

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

export function useDirectS3UploadForAttachment() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachFileMutation = useAttachFileMutation();

  const handleUploadError = (err: unknown) => {
    let message = "Direct S3 upload failed.";
    if (err instanceof Error) {
      message += ` Error: ${err.message}`;
    } else if (typeof err === "string") {
      message += ` Error: ${err}`;
    }
    setError(message);
    setIsUploading(false);
    throw err;
  };

  const upload = async (transactionId: string, file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const { uploadUrl, fileKey } =
        await TransactionFileService.getPresignedUploadUrl(
          transactionId,
          file.name,
          file.type
        );

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error(
          `S3 upload failed: ${uploadRes.status} ${uploadRes.statusText}`
        );
      }

      await attachFileMutation.mutateAsync({
        transactionId,
        fileMeta: {
          fileKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
      });
      setIsUploading(false);
      return { fileKey };
    } catch (err) {
      handleUploadError(err);
    }
  };

  return { isUploading, error, upload };
}
