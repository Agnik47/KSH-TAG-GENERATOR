/**
 * Styled, colour-coded Excel template (and sample) for the tag list.
 *
 * Sheet "Tags":  title (row 1), colour legend (row 2), header (row 3), data from row 4.
 *                Header colours: green = required, blue = old Wishkaro tags only, amber = copies.
 *                Number checks (data validation) and red highlighting of mistakes
 *                (conditional formatting) catch errors while typing.
 * Sheet "How to fill": what to type in each column, with the same colours.
 *
 * The app reads the header row wherever it is (see parseTagTable), so the title rows are fine.
 */
import ExcelJS from 'exceljs';
import { GROUP_LABEL, TEMPLATE_COLUMNS, type ColumnGroup } from './columns';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const TAGS_SHEET = 'Tags';
export const HELP_SHEET = 'How to fill';
/** Row of the column headers on the "Tags" sheet (1-based). */
export const HEADER_ROW = 3;
const FIRST_DATA_ROW = HEADER_ROW + 1;
/** Rows that get borders, checks and highlighting (more can be added; they are still read). */
export const STYLED_ROWS = 500;

/** Palette (ARGB), matching the app. */
const C = {
  brandDark: 'FF065F46',
  white: 'FFFFFFFF',
  ink: 'FF0F172A',
  muted: 'FF475569',
  legendBg: 'FFF1F5F9',
  border: 'FFCBD5E1',
  borderLight: 'FFE2E8F0',
  errorBg: 'FFFEE2E2',
  errorInk: 'FF991B1B',
  header: { required: 'FF047857', old: 'FF0369A1', copies: 'FFD97706' } satisfies Record<ColumnGroup, string>,
  tint: { required: 'FFF0FDF4', old: 'FFF0F9FF', copies: 'FFFFFBEB' } satisfies Record<ColumnGroup, string>,
};

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = (argb: string): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb } },
  left: { style: 'thin', color: { argb } },
  bottom: { style: 'thin', color: { argb } },
  right: { style: 'thin', color: { argb } },
});
const colLetter = (i: number) => String.fromCharCode(65 + i); // A… (7 columns)

export interface TemplateRow {
  scanIdentifier: string;
  productName: string;
  color?: string;
  size?: string;
  mrp: string | number;
  ourPrice: string | number;
  copies?: string | number | null;
}

/** Numbers go in as numbers (so Excel can check them); anything else stays text. */
function asCellValue(v: string | number | null | undefined, numeric: boolean): ExcelJS.CellValue {
  if (v === null || v === undefined || v === '') return null;
  if (numeric) {
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    if (String(v).trim() !== '' && Number.isFinite(n)) return n;
  }
  return String(v);
}

function buildTagsSheet(wb: ExcelJS.Workbook, rows: TemplateRow[]) {
  const ws = wb.addWorksheet(TAGS_SHEET, {
    properties: { tabColor: { argb: C.header.required } },
    views: [{ state: 'frozen', ySplit: HEADER_ROW, activeCell: `A${FIRST_DATA_ROW}`, showGridLines: false }],
  });
  const last = colLetter(TEMPLATE_COLUMNS.length - 1);
  const lastRow = FIRST_DATA_ROW + Math.max(STYLED_ROWS, rows.length) - 1;

  ws.columns = TEMPLATE_COLUMNS.map((c) => ({ key: c.header, width: c.width }));

  // Row 1: title bar.
  ws.mergeCells(`A1:${last}1`);
  const title = ws.getCell('A1');
  title.value = 'KSH Tag Studio  ·  Price tag list';
  title.font = { name: 'Calibri', size: 15, bold: true, color: { argb: C.white } };
  title.fill = solid(C.brandDark);
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;

  // Row 2: colour legend (coloured squares + labels) and the "red = fix" hint.
  ws.mergeCells(`A2:${last}2`);
  const legend = ws.getCell('A2');
  const square = (group: ColumnGroup): ExcelJS.RichText => ({
    text: '■ ',
    font: { name: 'Calibri', size: 12, color: { argb: C.header[group] } },
  });
  const label = (text: string): ExcelJS.RichText => ({ text, font: { name: 'Calibri', size: 10, color: { argb: C.muted } } });
  legend.value = {
    richText: [
      square('required'),
      label(`${GROUP_LABEL.required}      `),
      square('old'),
      label(`${GROUP_LABEL.old}      `),
      square('copies'),
      label(`${GROUP_LABEL.copies}      `),
      { text: '■ ', font: { name: 'Calibri', size: 12, color: { argb: 'FFDC2626' } } },
      label('Red cell = fix it before loading   ·   One row per product, starting at row 4'),
    ],
  };
  legend.fill = solid(C.legendBg);
  legend.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 22;

  // Row 3: colour-coded headers with a note explaining each column.
  const header = ws.getRow(HEADER_ROW);
  header.height = 24;
  TEMPLATE_COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.white } };
    cell.fill = solid(C.header[c.group]);
    cell.alignment = { vertical: 'middle', horizontal: c.numFmt === '@' ? 'left' : 'right', indent: c.numFmt === '@' ? 1 : 0 };
    cell.border = thin(C.border);
    cell.note = `${GROUP_LABEL[c.group]}\n\n${c.help}\n\nExample: ${c.example}`;
  });
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: TEMPLATE_COLUMNS.length } };

  // Data rows: tinted by column group, light borders, number formats.
  for (let r = FIRST_DATA_ROW; r <= lastRow; r++) {
    const row = ws.getRow(r);
    row.height = 18;
    TEMPLATE_COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.numFmt = c.numFmt;
      cell.fill = solid(C.tint[c.group]);
      cell.border = thin(C.borderLight);
      cell.font = { name: 'Calibri', size: 11, color: { argb: C.ink } };
      cell.alignment = { vertical: 'middle', indent: c.numFmt === '@' ? 1 : 0 };
    });
  }

  // Values.
  rows.forEach((r, k) => {
    const row = ws.getRow(FIRST_DATA_ROW + k);
    row.getCell(1).value = asCellValue(r.scanIdentifier, false);
    row.getCell(2).value = asCellValue(r.productName, false);
    row.getCell(3).value = asCellValue(r.color, false);
    row.getCell(4).value = asCellValue(r.size, false);
    row.getCell(5).value = asCellValue(r.mrp, true);
    row.getCell(6).value = asCellValue(r.ourPrice, true);
    row.getCell(7).value = asCellValue(r.copies, true);
  });

  // Checks while typing (Excel shows the prompt when a cell is selected, the error on bad input).
  const range = (col: string) => `${col}${FIRST_DATA_ROW}:${col}${lastRow}`;
  const prompt = (i: number) => ({
    showInputMessage: true,
    promptTitle: TEMPLATE_COLUMNS[i].header,
    prompt: TEMPLATE_COLUMNS[i].help.slice(0, 250),
  });
  // Range validations exist at runtime (ExcelJS 4) but are missing from its type definitions.
  const dv = (ws as unknown as { dataValidations: { add: (ref: string, v: ExcelJS.DataValidation) => void } }).dataValidations;
  dv.add(range('A'), {
    type: 'textLength',
    operator: 'lessThanOrEqual',
    formulae: [40],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: 'Barcode too long',
    error: 'A barcode can be at most 40 characters (it must fit on the tag).',
    ...prompt(0),
  });
  dv.add(range('B'), {
    type: 'textLength',
    operator: 'lessThanOrEqual',
    formulae: [80],
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Long name',
    error: 'Names over ~60 characters are printed smaller.',
    ...prompt(1),
  });
  for (const [col, i] of [
    ['E', 4],
    ['F', 5],
  ] as const) {
    dv.add(range(col), {
      type: 'decimal',
      operator: 'greaterThan',
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Price must be a number',
      error: 'Type the price in rupees as a number greater than 0, e.g. 595 or 282.10.',
      ...prompt(i),
    });
  }
  dv.add(range('G'), {
    type: 'whole',
    operator: 'between',
    formulae: [0, 999],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: 'Copies: 0 to 999',
    error: 'Type a whole number from 0 to 999. Empty = 1 tag, 0 = skip this row.',
    ...prompt(6),
  });

  // Red highlighting of mistakes (also catches values pasted past the checks above).
  const red: Partial<ExcelJS.Style> = {
    fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.errorBg } },
    font: { color: { argb: C.errorInk }, bold: true },
  };
  const r0 = FIRST_DATA_ROW;
  let priority = 0; // Excel expects a unique priority per rule
  const rule = (ref: string, formula: string) =>
    ws.addConditionalFormatting({ ref, rules: [{ type: 'expression', priority: ++priority, formulae: [formula], style: red }] });
  // Barcode / name missing while the row has other data.
  rule(range('A'), `AND(TRIM($A${r0})="",COUNTA($B${r0}:$G${r0})>0)`);
  rule(range('B'), `AND(TRIM($B${r0})="",COUNTA($A${r0},$C${r0}:$G${r0})>0)`);
  // MRP / price: filled but not a positive number; or price above MRP.
  rule(`E${r0}:F${lastRow}`, `IF(E${r0}="",FALSE,IF(ISNUMBER(E${r0}),E${r0}<=0,TRUE))`);
  rule(range('E'), `AND(TRIM($A${r0})<>"",$E${r0}="")`);
  rule(range('F'), `AND(TRIM($A${r0})<>"",$F${r0}="")`);
  rule(range('F'), `IF(AND(ISNUMBER($E${r0}),ISNUMBER($F${r0})),$F${r0}>$E${r0},FALSE)`);
  // Copies outside 0–999 or not whole.
  rule(range('G'), `IF($G${r0}="",FALSE,IF(ISNUMBER($G${r0}),OR($G${r0}<0,$G${r0}>999,$G${r0}<>INT($G${r0})),TRUE))`);

  return ws;
}

function buildHelpSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet(HELP_SHEET, {
    properties: { tabColor: { argb: C.header.old } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 18 }, { width: 28 }, { width: 70 }, { width: 30 }];

  ws.mergeCells('A1:D1');
  const title = ws.getCell('A1');
  title.value = 'How to fill the "Tags" sheet';
  title.font = { size: 15, bold: true, color: { argb: C.white } };
  title.fill = solid(C.brandDark);
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;

  const head = ws.getRow(3);
  ['Column', 'Needed?', 'What to type', 'Example'].forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: C.ink } };
    cell.fill = solid(C.legendBg);
    cell.border = thin(C.border);
    cell.alignment = { vertical: 'middle', indent: 1 };
  });
  head.height = 22;

  TEMPLATE_COLUMNS.forEach((c, k) => {
    const row = ws.getRow(4 + k);
    row.values = [c.header, GROUP_LABEL[c.group], c.help, c.example];
    row.height = 30;
    row.eachCell((cell, i) => {
      cell.border = thin(C.borderLight);
      cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
      cell.font = { color: { argb: C.ink }, bold: i === 1 };
    });
    const needed = row.getCell(2);
    needed.fill = solid(C.header[c.group]);
    needed.font = { bold: true, color: { argb: C.white } };
  });

  const steps = [
    'Steps',
    '1.  Fill one row per product on the "Tags" sheet, starting at row 4. Do not change the header row (row 3).',
    '2.  A red cell means a mistake (missing barcode or name, price not a number, price above MRP, copies not 0–999). Fix it first.',
    '3.  Old Wishkaro tags: fill Color and Size. New KSH Surplus tags: leave both empty.',
    '4.  Save the file. In KSH Tag Studio click "Open file" (or drop the file on the page). Excel and CSV both work.',
    '5.  Click "Test print (1 each)", print and scan each tag at the POS. If all scan, click "Download print PDF".',
    '6.  Print at Actual size / 100% on the Zebra GX430t, paper 75 × 125 mm, portrait.',
  ];
  const start = 5 + TEMPLATE_COLUMNS.length;
  steps.forEach((text, k) => {
    const r = start + k;
    ws.mergeCells(`A${r}:D${r}`);
    const cell = ws.getCell(`A${r}`);
    cell.value = text;
    cell.font = k === 0 ? { bold: true, size: 12, color: { argb: C.brandDark } } : { color: { argb: C.ink } };
    cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    ws.getRow(r).height = k === 0 ? 22 : 20;
  });

  return ws;
}

/**
 * Build the workbook. With no rows it is the blank template; with rows it is a filled sample.
 * Returns the .xlsx bytes.
 */
export async function buildTagsWorkbook(rows: TemplateRow[] = []): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KSH Tag Studio';
  wb.title = 'KSH price tag list';
  wb.created = new Date(Date.UTC(2026, 0, 1)); // fixed, so the file is reproducible
  buildTagsSheet(wb, rows);
  buildHelpSheet(wb);
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
