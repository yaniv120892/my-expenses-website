import { CSV_BOM } from '@/shared/csv';

const FILENAME_PATTERN = /filename="?([^";]+)"?/i;

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** For CSV built in the browser; a server response already carries its own BOM. */
export function downloadCsv(fileName: string, csv: string): void {
  downloadBlob(
    fileName,
    new Blob([`${CSV_BOM}${csv}`], { type: 'text/csv;charset=utf-8;' }),
  );
}

/** The export route names the file, so the browser saves what the server chose. */
export function filenameFromContentDisposition(
  header: string | undefined,
  fallback: string,
): string {
  return header?.match(FILENAME_PATTERN)?.[1]?.trim() || fallback;
}
