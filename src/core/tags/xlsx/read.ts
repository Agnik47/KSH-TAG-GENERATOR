import ExcelJS from 'exceljs';
import { TAGS_SHEET } from './template';

/** Turn any Excel cell value into the text a person sees / typed. */
export function cellToText(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    // Remove float noise (282.09999999999997 → 282.1) without touching real decimals.
    return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(15)));
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('formula' in value || 'sharedFormula' in value) {
      return cellToText((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    }
    if ('error' in value) return String(value.error);
    if ('text' in value) return String((value as ExcelJS.CellHyperlinkValue).text);
  }
  return String(value);
}

export interface WorkbookTable {
  sheetName: string;
  /** Cell texts, rows × columns, starting at Excel row 1 (so index + 1 = Excel row number). */
  rows: string[][];
}

/**
 * Read the tag list from an .xlsx file: the "Tags" sheet if there is one, otherwise the first sheet.
 * Throws if the bytes are not a readable .xlsx workbook.
 */
export async function readTagsWorkbook(bytes: Uint8Array | ArrayBuffer): Promise<WorkbookTable> {
  const wb = new ExcelJS.Workbook();
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  await wb.xlsx.load(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  const ws = wb.getWorksheet(TAGS_SHEET) ?? wb.worksheets.find((s) => s.state !== 'hidden') ?? wb.worksheets[0];
  if (!ws) return { sheetName: '', rows: [] };

  const rowCount = ws.rowCount;
  const colCount = ws.columnCount;
  const rows: string[][] = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= colCount; c++) cells.push(cellToText(row.getCell(c).value).trim());
    rows.push(cells);
  }
  return { sheetName: ws.name, rows };
}
