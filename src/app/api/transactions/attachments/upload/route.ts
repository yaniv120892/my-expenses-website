import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const s3Client = new S3Client({
  region: process.env.TRANSACTION_ATTACHMENT_S3_REGION,
  credentials: {
    accessKeyId: process.env.TRANSACTION_ATTACHMENT_S3_ACCESS_KEY_ID || "",
    secretAccessKey:
      process.env.TRANSACTION_ATTACHMENT_S3_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const transactionId = formData.get("transactionId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    if (!validateFileSize(file)) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }    

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const fileKey = generateUniqueFileName(file.name, transactionId);
    await uploadFileToS3(fileKey, fileBuffer, file.type);

    return NextResponse.json({
      fileKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error("Error uploading transaction file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

function generateUniqueFileName(
  originalFileName: string,
  transactionId: string
): string {
  const extension = originalFileName.split(".").pop();
  const baseName = originalFileName.replace(`.${extension}`, "");
  return `transactions/${transactionId}/${uuidv4()}-${baseName}.${extension}`;
}

function validateFileSize(file: File): boolean {
  const maxSize = 10 * 1024 * 1024; 
  return file.size <= maxSize;
}

async function uploadFileToS3(
  fileKey: string,
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<void> {
  try {
    const putCommand = new PutObjectCommand({
      Bucket: process.env.TRANSACTION_ATTACHMENT_S3_BUCKET || "",
      Key: fileKey,
      Body: Buffer.from(fileBuffer),
      ContentType: contentType,
    });

    await s3Client.send(putCommand);
  } catch (error) {
    console.error("S3 Upload Error Details:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      bucket: process.env.TRANSACTION_ATTACHMENT_S3_BUCKET,
      region: process.env.TRANSACTION_ATTACHMENT_S3_REGION,
    });
    throw error;
  }
}
