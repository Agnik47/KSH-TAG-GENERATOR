import Papa from 'papaparse';
import type { RawRow } from '../types';

type Field = 'scanIdentifier' | 'productName' | 'color' | 'size' | 'mrp' | 'ourPrice' | 'copies';

/** Header names (lower-case) → field. Canonical names first, then aliases (docs/02). */
const HEADER_ALIASES: Record<string, Field> = {
  scanidentifier: 'scanIdentifier',
  barcode: 'scanIdentifier',
  sku: 'scanIdentifier',
  code: 'scanIdentifier',
  productname: 'productName',
  name: 'productName',
  title: 'productName',
  color: 'color',
  colour: 'color',
  size: 'size',
  mrp: 'mrp',
  ourprice: 'ourPrice',
  sellingprice: 'ourPrice',
  price: 'ourPrice',
  sp: 'ourPrice',
  copies: 'copies',
  qty: 'copies',
  quantity: 'copies',
};

/** Canonical header name per field, used when a canonical header and an alias are both present. */
const CANONICAL: Record<Field, string> = {
  scanIdentifier: 'scanidentifier',
  productName: 'productname',
  color: 'color',
  size: 'size',
  mrp: 'mrp',
  ourPrice: 'ourprice',
  copies: 'copies',
};

function normaliseHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

export interface ParseResult {
  rows: RawRow[];
  /** Problems with the file as a whole (e.g. a required column is missing). */
  fileErrors: string[];
  /** Header in the file → field it was read into. */
  columns: Partial<Record<Field, string>>;
  hasCopiesColumn: boolean;
}

/** How many leading rows to search for the header (title / note rows may come first). */
const HEADER_SEARCH_ROWS = 10;

const isBlankRow = (cells: string[]) => cells.every((c) => (c ?? '').trim() === '');

/**
 * Find the header row: the first row (within the first 10) that names the barcode column and
 * at least one other known column. Lets a styled Excel sheet have a title above the header.
 * Falls back to the first non-blank row so "Missing column" errors stay meaningful.
 */
function findHeaderRow(data: string[][]): number {
  const limit = Math.min(data.length, HEADER_SEARCH_ROWS);
  for (let r = 0; r < limit; r++) {
    const fields = data[r].map((h) => HEADER_ALIASES[normaliseHeader(h ?? '')]).filter(Boolean);
    if (fields.includes('scanIdentifier') && fields.length >= 2) return r;
  }
  return data.findIndex((row) => !isBlankRow(row));
}

/**
 * Parse an input CSV (docs/02). Header names are case-insensitive, aliases are accepted
 * and unknown columns are ignored. Values are trimmed. Fully blank lines are dropped.
 */
export function parseTagCsv(text: string): ParseResult {
  // Blank lines are kept here (and dropped later) so RawRow.line matches the line in the file.
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { header: false, skipEmptyLines: false });
  return parseTagTable(parsed.data);
}

/**
 * Parse a table of cell texts (rows × columns), e.g. from a CSV or an Excel sheet.
 * `RawRow.line` is the 1-based row number in that table (= Excel row / CSV line).
 */
export function parseTagTable(data: string[][]): ParseResult {
  const fileErrors: string[] = [];
  const headerRow = findHeaderRow(data);
  if (headerRow === -1) {
    return { rows: [], fileErrors: ['The file is empty.'], columns: {}, hasCopiesColumn: false };
  }

  // Map header → column index. Prefer the canonical header when both canonical and alias exist.
  const rawHeader = data[headerRow].map((h) => h ?? '');
  const header = rawHeader.map(normaliseHeader);
  const index: Partial<Record<Field, number>> = {};
  const columns: Partial<Record<Field, string>> = {};
  // Pass 1: canonical names; pass 2: aliases for fields still unmapped (first alias wins).
  for (const pass of ['canonical', 'alias'] as const) {
    header.forEach((h, i) => {
      const field = HEADER_ALIASES[h];
      if (!field || index[field] !== undefined) return;
      if ((pass === 'canonical') !== (h === CANONICAL[field])) return;
      index[field] = i;
      columns[field] = rawHeader[i].replace(/^\uFEFF/, '').trim();
    });
  }

  const required: Array<[Field, string]> = [
    ['scanIdentifier', 'ScanIdentifier'],
    ['productName', 'ProductName'],
    ['mrp', 'MRP'],
    ['ourPrice', 'OurPrice'],
  ];
  for (const [field, label] of required) {
    if (index[field] === undefined) fileErrors.push(`Missing column: ${label}`);
  }

  const hasCopiesColumn = index.copies !== undefined;
  const get = (cells: string[], f: Field) => {
    const i = index[f];
    return i === undefined ? '' : (cells[i] ?? '').trim();
  };

  const rows: RawRow[] = [];
  for (let r = headerRow + 1; r < data.length; r++) {
    const cells = data[r];
    if (isBlankRow(cells)) continue;
    rows.push({
      line: r + 1,
      scanIdentifier: get(cells, 'scanIdentifier'),
      productName: get(cells, 'productName'),
      color: get(cells, 'color'),
      size: get(cells, 'size'),
      mrp: get(cells, 'mrp'),
      ourPrice: get(cells, 'ourPrice'),
      copies: hasCopiesColumn ? get(cells, 'copies') : null,
    });
  }

  return { rows, fileErrors, columns, hasCopiesColumn };
}
