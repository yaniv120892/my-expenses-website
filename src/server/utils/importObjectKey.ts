// The key is also the path of the fileUrl handed to the extraction service, so
// it holds only characters a URL path carries verbatim; the user's own file
// name is kept separately as Import.originalFileName.
const URL_UNSAFE_CHARACTERS = /[^A-Za-z0-9._-]+/g;

export function buildImportObjectKey(fileName: string, id: string): string {
  return `imports/${id}-${fileName.replace(URL_UNSAFE_CHARACTERS, '_')}`;
}
