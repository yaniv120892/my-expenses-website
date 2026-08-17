/**
 * Excel only detects UTF-8 from a BOM, and category names may be Hebrew. Shared
 * because CSV is built both on the server and in the browser.
 */
export const CSV_BOM = '\uFEFF';
