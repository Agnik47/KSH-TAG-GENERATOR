import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { parseTagTable } from '@/core/tags/csv/parse';
import { summarise, validateRows } from '@/core/tags/csv/validate';
import {
  HEADER_ROW,
  HELP_SHEET,
  TAGS_SHEET,
  TEMPLATE_COLUMNS,
  buildTagsWorkbook,
  cellToText,
  readTagsWorkbook,
  type TemplateRow,
} from '@/core/tags/xlsx';
import { readSample } from '../helpers/fixtures';

function sampleRows(): TemplateRow[] {
  const data = Papa.parse<Record<string, string>>(readSample('ksh_tags_sample_input.csv'), {
    header: true,
    skipEmptyLines: true,
  }).data;
  return data.map((r) => ({
    scanIdentifier: r.ScanIdentifier,
    productName: r.ProductName,
    color: r.Color,
    size: r.Size,
    mrp: r.MRP,
    ourPrice: r.OurPrice,
    copies: r.Copies,
  }));
}

async function open(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return wb;
}

describe('Excel template', () => {
  it('has a Tags sheet (title, legend, colour-coded header) and a How to fill sheet', async () => {
    const wb = await open(await buildTagsWorkbook());
    expect(wb.worksheets.map((w) => w.name)).toEqual([TAGS_SHEET, HELP_SHEET]);
    const ws = wb.getWorksheet(TAGS_SHEET)!;
    expect(cellToText(ws.getCell('A1').value)).toContain('KSH Tag Studio');
    expect(cellToText(ws.getCell('A2').value)).toContain('Red cell = fix it');

    const header = ws.getRow(HEADER_ROW);
    expect(TEMPLATE_COLUMNS.map((_, i) => cellToText(header.getCell(i + 1).value))).toEqual([
      'ScanIdentifier',
      'ProductName',
      'Color',
      'Size',
      'MRP',
      'OurPrice',
      'Copies',
    ]);
    const fill = (col: number) => (header.getCell(col).fill as ExcelJS.FillPattern).fgColor?.argb;
    expect(fill(1)).toBe('FF047857'); // required = green
    expect(fill(3)).toBe('FF0369A1'); // old tags = blue
    expect(fill(7)).toBe('FFD97706'); // copies = amber
    expect(header.getCell(1).note).toBeTruthy();
    // Codes are stored as text so leading zeros survive.
    expect(ws.getCell(`A${HEADER_ROW + 1}`).numFmt).toBe('@');
    // Frozen header, filter on the header row.
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: HEADER_ROW });
    expect(ws.autoFilter).toBeTruthy();
  });

  it('has number checks and red highlighting rules', async () => {
    const wb = await open(await buildTagsWorkbook());
    const ws = wb.getWorksheet(TAGS_SHEET)!;
    expect(ws.getCell('G4').dataValidation).toMatchObject({ type: 'whole', formulae: [0, 999] });
    expect(ws.getCell('E10').dataValidation).toMatchObject({ type: 'decimal', operator: 'greaterThan' });
    const formulas = (
      ws as unknown as { conditionalFormattings: Array<{ rules: Array<{ formulae: string[] }> }> }
    ).conditionalFormattings
      .flatMap((cf) => cf.rules.flatMap((r) => r.formulae))
      .join(' ');
    expect(formulas).toContain('$F4>$E4'); // price above MRP
    expect(formulas).toContain('$G4>999'); // copies range
  });

  it('a blank template loads as "no product rows"', async () => {
    const table = await readTagsWorkbook(await buildTagsWorkbook());
    const parsed = parseTagTable(table.rows);
    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.rows).toEqual([]);
  });

  it('the sample round-trips: 20 ready rows, same values as the sample CSV', async () => {
    const table = await readTagsWorkbook(await buildTagsWorkbook(sampleRows()));
    expect(table.sheetName).toBe(TAGS_SHEET);
    const parsed = parseTagTable(table.rows);
    expect(parsed.fileErrors).toEqual([]);
    const rows = validateRows(parsed.rows);
    expect(summarise(rows)).toMatchObject({ total: 20, ready: 20, errors: 0, labels: 20 });
    // Line numbers are Excel row numbers (data starts at row 4).
    expect(parsed.rows[0].line).toBe(HEADER_ROW + 1);
    const bt = rows.find((r) => r.raw.scanIdentifier === 'bt539cfe')!;
    expect(bt.raw).toMatchObject({ color: 'Red', size: '0M – 2Y', mrp: '998', ourPrice: '282' });
    expect(bt.tag).toMatchObject({ layout: 'old', ourPrice: 282, youSave: 716 });
  });
});

describe('reading Excel files people made themselves', () => {
  it('reads the first sheet, any header names (aliases), numbers, formulas and rich text', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['SKU', 'Name', 'Colour', 'Size', 'MRP', 'SP', 'Qty']);
    ws.addRow([
      'bt539cfe',
      { richText: [{ text: 'Baby ' }, { text: 'Shorts', font: { bold: true } }] },
      'Red',
      '0M – 2Y',
      998,
      282.1,
      3,
    ]);
    ws.addRow([8901234567890, 'Numeric code', '', '', { formula: '500*2', result: 1000 }, 499.5, null]);
    const bytes = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const table = await readTagsWorkbook(bytes);
    const rows = validateRows(parseTagTable(table.rows).rows);
    expect(rows.map((r) => r.status)).toEqual(['ready', 'ready']);
    expect(rows[0]).toMatchObject({ copies: 3, tag: { productName: 'Baby Shorts', ourPrice: 282 } });
    expect(rows[1]).toMatchObject({ copies: 1, tag: { scanIdentifier: '8901234567890', mrp: 1000, ourPrice: 500 } });
  });

  it('cellToText handles every cell type', () => {
    expect(cellToText(null)).toBe('');
    expect(cellToText(282.09999999999997)).toBe('282.1');
    expect(cellToText(1190)).toBe('1190');
    expect(cellToText(true)).toBe('TRUE');
    expect(cellToText(new Date(Date.UTC(2026, 10, 25)))).toBe('2026-11-25');
    expect(cellToText({ formula: 'A1', result: 'x' } as ExcelJS.CellFormulaValue)).toBe('x');
    expect(cellToText({ error: '#N/A' } as ExcelJS.CellErrorValue)).toBe('#N/A');
    expect(cellToText({ text: 'link', hyperlink: 'http://x' } as ExcelJS.CellHyperlinkValue)).toBe('link');
  });

  it('rejects bytes that are not an xlsx', async () => {
    await expect(readTagsWorkbook(new TextEncoder().encode('not a zip'))).rejects.toThrow();
  });
});

describe('header row search (CSV too)', () => {
  it('skips title rows above the header', () => {
    const parsed = parseTagTable([
      ['My tag list', '', ''],
      [''],
      ['ScanIdentifier', 'ProductName', 'MRP', 'OurPrice'],
      ['abc', 'Thing', '100', '50'],
    ]);
    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.rows).toEqual([expect.objectContaining({ line: 4, scanIdentifier: 'abc' })]);
  });
});
