import { createHandler } from '@/server/http/handler';
import { HttpError } from '@/server/http/errors';
import { logger } from '@/server/observability';
import { buildImportObjectKey } from '@/server/utils/importObjectKey';
import { keySafeExtension } from '@/server/utils/storageObjectName';
import { assertWithinUploadLimit } from '@/server/utils/uploadLimit';
import { importsBucket, putImportObject } from '@/server/services/importFileStorage';
import { STATEMENT_UPLOAD_RATE_LIMITS } from '@/server/costFences';
import { refuseIfStatementLimited } from '@/server/http/guardRefusal';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export const POST = createHandler({
  auth: 'session',
  apiTokenScope: 'IMPORTS',
  handler: async ({ request, userId, actor }) => {
    const refusal = await refuseIfStatementLimited({
      policies: STATEMENT_UPLOAD_RATE_LIMITS,
      householdId: actor.householdId,
    });
    if (refusal) {
      return refusal;
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new HttpError(400, 'No file provided');
    }

    if (!ALLOWED_EXTENSIONS.includes(keySafeExtension(file.name))) {
      throw new HttpError(400, `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }
    assertWithinUploadLimit({ fileName: file.name, sizeInBytes: file.size });

    const key = buildImportObjectKey({ userId, fileName: file.name, id: crypto.randomUUID() });
    try {
      const fileUrl = await putImportObject({
        key,
        body: Buffer.from(await file.arrayBuffer()),
        contentType: file.type,
      });
      return { fileUrl };
    } catch (err) {
      logger.error({ err, ...importsBucket() }, 'S3 upload failed');
      throw new HttpError(500, 'Failed to upload file');
    }
  },
});
