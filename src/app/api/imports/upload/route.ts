import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.IMPORTS_S3_REGION,
  credentials: {
    accessKeyId: process.env.IMPORTS_S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.IMPORTS_S3_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    const file = await extractFileFromRequest(request);
    const fileBuffer = await file.arrayBuffer();
    const fileName = generateUniqueFileName(file.name);
    const fileUrl = await uploadFileToS3(fileName, fileBuffer, file.type);

    return NextResponse.json({ fileUrl });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

async function extractFileFromRequest(request: NextRequest): Promise<File> {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    throw new Error("No file provided");
  }

  return file;
}

function generateUniqueFileName(originalFileName: string): string {
  return `imports/${uuidv4()}-${originalFileName}`;
}

async function uploadFileToS3(
  fileName: string,
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<string> {
  try {
    const putCommand = new PutObjectCommand({
      Bucket: process.env.IMPORTS_S3_BUCKET || "",
      Key: fileName,
      Body: Buffer.from(fileBuffer),
      ContentType: contentType,
    });

    await s3Client.send(putCommand);
    return generateS3Url(fileName);
  } catch (error) {
    console.error("S3 Upload Error Details:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      bucket: process.env.IMPORTS_S3_BUCKET,
      region: process.env.IMPORTS_S3_REGION,
    });
    throw error;
  }
}

function generateS3Url(fileName: string): string {
  return `https://${process.env.IMPORTS_S3_BUCKET}.s3.${process.env.IMPORTS_S3_REGION}.amazonaws.com/${fileName}`;
}
