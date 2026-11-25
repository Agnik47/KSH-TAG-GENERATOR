import { MAX_FILE_BYTES } from '@/config/site';

/** What a loaded file turned into: CSV text, or the cell table of an Excel sheet. */
export type TagFileContent = { kind: 'csv'; text: string } | { kind: 'table'; rows: string[][] };

export type ReadTagFileResult =
  | {
      ok: true;
      content: TagFileContent;
      /** Non-blocking note, e.g. the CSV was not UTF-8 and was read as Windows-1252. */
      notice?: string;
    }
  | { ok: false; error: string };

export type TagFileKind = 'csv' | 'xlsx';

const CSV_TYPES = new Set(['', 'text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'text/x-csv']);
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Accept attribute for the file picker. */
export const TAG_FILE_ACCEPT = `.csv,.xlsx,text/csv,${XLSX_TYPE}`;

/**
 * Decide from name/type/size what kind of file this is.
 * Returns the kind, or a message that tells the person what to do instead.
 */
export function checkTagFile(name: string, type: string, size: number): { kind: TagFileKind } | { error: string } {
  const lower = name.toLowerCase();
  let kind: TagFileKind | null = null;
  if (lower.endsWith('.xlsx') || type === XLSX_TYPE) kind = 'xlsx';
  else if (/\.(xls|xlsm|xlsb|ods|numbers)$/.test(lower)) {
    return {
      error:
        'This spreadsheet type cannot be read. Save it as Excel Workbook (.xlsx) or "CSV UTF-8 (Comma delimited)" and load that.',
    };
  } else if (lower.endsWith('.csv') || lower.endsWith('.txt') || CSV_TYPES.has(type)) kind = 'csv';
  if (!kind) return { error: 'Please choose an Excel (.xlsx) or CSV file.' };
  if (size === 0) return { error: 'The file is empty.' };
  if (size > MAX_FILE_BYTES) {
    return {
      error: `The file is too big (${(size / 1024 / 1024).toFixed(1)} MB). The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    };
  }
  return { kind };
}

/**
 * Decode CSV bytes. Excel's plain "CSV (Comma delimited)" saves in Windows-1252, not UTF-8,
 * which would turn "–" or "₹" into "�". Try strict UTF-8 first; fall back to Windows-1252.
 */
export function decodeCsvBytes(bytes: Uint8Array): { text: string; notice?: string } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return {
      text: new TextDecoder('windows-1252').decode(bytes),
      notice: 'The file was not saved as UTF-8, so it was read as Windows (Excel) text. Check sizes like "0M – 2Y" in the table.',
    };
  }
}

/** Read a chosen file locally (nothing is uploaded). Excel support is loaded only when needed. */
export async function readTagFile(file: File): Promise<ReadTagFileResult> {
  const check = checkTagFile(file.name, file.type, file.size);
  if ('error' in check) return { ok: false, error: check.error };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, error: 'The file could not be read. Is it open in another program?' };
  }

  if (check.kind === 'csv') {
    const { text, notice } = decodeCsvBytes(bytes);
    return { ok: true, content: { kind: 'csv', text }, notice };
  }

  try {
    const { readTagsWorkbook } = await import('@/core/tags/xlsx');
    const { rows, sheetName } = await readTagsWorkbook(bytes);
    const notice = sheetName && sheetName !== 'Tags' ? `Read the sheet "${sheetName}".` : undefined;
    return { ok: true, content: { kind: 'table', rows }, notice };
  } catch {
    return {
      ok: false,
      error:
        'This Excel file could not be read. It may be damaged or password-protected. Try Save As → Excel Workbook (.xlsx) again.',
    };
  }
}
