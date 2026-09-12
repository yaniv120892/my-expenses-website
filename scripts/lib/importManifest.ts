/**
 * The manifest `scripts/import-statements.ts` keeps beside a statements
 * directory: which import each file became on each target, and what the last
 * preview of that import contained. It is what lets a commit run act on the
 * dry run's imports instead of uploading everything a second time.
 */
import { z } from 'zod';

export const MANIFEST_FILE_NAME = '.import-statements.json';

const manifestStatementSchema = z.object({
  importId: z.string().min(1),
  submittedAt: z.string().min(1),
});

const manifestPreviewSchema = z.object({
  rowIds: z.array(z.string()),
  previewedAt: z.string().min(1),
});

const targetManifestSchema = z.object({
  statements: z.record(manifestStatementSchema),
  previews: z.record(manifestPreviewSchema),
});

const importManifestSchema = z.object({
  version: z.literal(1),
  targets: z.record(targetManifestSchema),
});

export type ManifestStatement = z.infer<typeof manifestStatementSchema>;
export type ManifestPreview = z.infer<typeof manifestPreviewSchema>;
export type ImportManifest = z.infer<typeof importManifestSchema>;

export type PlanDrift = { added: number; removed: number };

export function emptyManifest(): ImportManifest {
  return { version: 1, targets: {} };
}

export function parseManifest(text: string, source: string): ImportManifest {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${source} is not valid JSON; fix or delete it`);
  }
  const parsed = importManifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `${source} does not look like an import manifest; fix or delete it (${parsed.error.issues[0]?.message ?? 'invalid'})`,
    );
  }
  return parsed.data;
}

export function serializeManifest(manifest: ImportManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function recordedImport(
  manifest: ImportManifest,
  baseUrl: string,
  fileName: string,
): ManifestStatement | undefined {
  return manifest.targets[baseUrl]?.statements[fileName];
}

export function recordedPreview(
  manifest: ImportManifest,
  baseUrl: string,
  importId: string,
): ManifestPreview | undefined {
  return manifest.targets[baseUrl]?.previews[importId];
}

export function withSubmission(
  manifest: ImportManifest,
  baseUrl: string,
  fileName: string,
  importId: string,
  at: Date,
): ImportManifest {
  const target = targetOf(manifest, baseUrl);
  return withTarget(manifest, baseUrl, {
    ...target,
    statements: {
      ...target.statements,
      [fileName]: { importId, submittedAt: at.toISOString() },
    },
  });
}

/**
 * Points a file at the import its rows ended up in — after a merge, the
 * survivor rather than the upload — keeping when it was submitted.
 */
export function withResolvedImport(
  manifest: ImportManifest,
  baseUrl: string,
  fileName: string,
  importId: string,
): ImportManifest {
  const target = targetOf(manifest, baseUrl);
  const existing = target.statements[fileName];
  if (!existing || existing.importId === importId) {
    return manifest;
  }
  return withTarget(manifest, baseUrl, {
    ...target,
    statements: { ...target.statements, [fileName]: { ...existing, importId } },
  });
}

export function withPreview(
  manifest: ImportManifest,
  baseUrl: string,
  importId: string,
  rowIds: string[],
  at: Date,
): ImportManifest {
  const target = targetOf(manifest, baseUrl);
  return withTarget(manifest, baseUrl, {
    ...target,
    previews: {
      ...target.previews,
      [importId]: { rowIds: [...rowIds], previewedAt: at.toISOString() },
    },
  });
}

/** How the rows in a plan differ from the rows previewed last time. */
export function planDrift(
  previewedRowIds: string[],
  planRowIds: string[],
): PlanDrift {
  const previewed = new Set(previewedRowIds);
  const planned = new Set(planRowIds);
  return {
    added: planRowIds.filter((id) => !previewed.has(id)).length,
    removed: previewedRowIds.filter((id) => !planned.has(id)).length,
  };
}

function targetOf(
  manifest: ImportManifest,
  baseUrl: string,
): ImportManifest['targets'][string] {
  return manifest.targets[baseUrl] ?? { statements: {}, previews: {} };
}

function withTarget(
  manifest: ImportManifest,
  baseUrl: string,
  target: ImportManifest['targets'][string],
): ImportManifest {
  return {
    ...manifest,
    targets: { ...manifest.targets, [baseUrl]: target },
  };
}
