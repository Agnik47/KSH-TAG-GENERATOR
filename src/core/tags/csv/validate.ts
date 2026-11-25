import { isPrintableAscii, planBarcode } from '../barcode/code128';
import type { Layout, RawRow, TagData, ValidatedRow } from '../types';

export const MAX_COPIES = 999;
/** Copies is at most 3 digits (0–999). */
export const MAX_COPIES_DIGITS = 3;

/** Error messages (docs/02). Exported so tests and the UI can refer to them. */
export const ERR = {
  missingBarcode: 'Missing barcode',
  invalidBarcode: 'Invalid barcode characters',
  barcodeTooLong: 'Barcode too long',
  missingName: 'Missing name',
  badMrp: 'Bad MRP',
  badPrice: 'Bad price',
  priceAboveMrp: 'Price above MRP',
  badCopies: 'Bad copies',
} as const;

/**
 * Parse a price. Accepts "1190", "1190.00", "₹1,190", "Rs. 1190" → number.
 * Returns null if it is not a plain positive number.
 */
export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/₹|rs\.?|inr/gi, '').replace(/[,\s]/g, '');
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Round half up to whole rupees (282.10 → 282, 282.50 → 283). Tolerates float noise. */
export function roundRupees(n: number): number {
  return Math.floor(n + 0.5 + 1e-9);
}

/**
 * Parse Copies (docs/02): empty / no column = 1; otherwise a whole number 0–999.
 * Leading zeros are tolerated in files ("011" = 11) and `2.0` (Excel) = 2. null = bad.
 */
export function parseCopies(text: string | null): number | null {
  if (text === null) return 1;
  const t = text.trim();
  if (t === '') return 1;
  if (!/^\d+(\.0+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n >= 0 && n <= MAX_COPIES ? n : null;
}

/**
 * Clean what a person types into a Copies box: digits only, no leading zeros
 * ("011" → "11", "000" → "0"), at most 3 digits. Empty stays empty (= 1 copy).
 */
export function sanitizeCopiesInput(text: string): string {
  const digits = text.replace(/\D/g, '');
  if (digits === '') return '';
  const trimmed = digits.replace(/^0+(?=\d)/, '');
  return trimmed.slice(0, MAX_COPIES_DIGITS);
}

export function chooseLayout(color: string, size: string): Layout {
  return color.trim() !== '' || size.trim() !== '' ? 'old' : 'new';
}

/** SKU line text (docs/02). On the tag, the Size part is drawn in bold. */
export function buildSkuLine(code: string, layout: Layout, color: string, size: string): string {
  return layout === 'new' ? `SKU : ${code}` : `SKU : ${code}  |  Color : ${color}  |  Size : ${size}`;
}

let idCounter = 0;
function nextId(raw: RawRow): string {
  idCounter += 1;
  return `row-${raw.line}-${idCounter}`;
}

/**
 * Validate one row and compute the derived values. A row with any error is never printed.
 * `copies` = 0 (and no other error) → status "skipped".
 */
export function validateRow(raw: RawRow, id?: string): ValidatedRow {
  const errors: string[] = [];
  const code = raw.scanIdentifier.trim();
  const name = raw.productName.trim();
  const color = raw.color.trim();
  const size = raw.size.trim();

  let barcodeDots: number | null = null;
  if (code === '') {
    errors.push(ERR.missingBarcode);
  } else if (!isPrintableAscii(code)) {
    errors.push(ERR.invalidBarcode);
  } else {
    try {
      barcodeDots = planBarcode(code).dots;
      if (barcodeDots === null) errors.push(ERR.barcodeTooLong);
    } catch {
      errors.push(ERR.invalidBarcode);
    }
  }

  if (name === '') errors.push(ERR.missingName);

  const mrp = parsePrice(raw.mrp);
  if (mrp === null) errors.push(ERR.badMrp);
  const price = parsePrice(raw.ourPrice);
  if (price === null) errors.push(ERR.badPrice);
  if (mrp !== null && price !== null && price > mrp) errors.push(ERR.priceAboveMrp);

  const copies = parseCopies(raw.copies);
  if (copies === null) errors.push(ERR.badCopies);
  const copiesText = copies === null ? (raw.copies ?? '') : String(copies);

  const rowId = id ?? nextId(raw);

  if (errors.length > 0 || mrp === null || price === null || copies === null || barcodeDots === null) {
    return { id: rowId, raw, status: 'error', errors, copies: 0, copiesText, tag: null };
  }

  const layout = chooseLayout(color, size);
  const ourPrice = roundRupees(price);
  const tag: TagData = {
    scanIdentifier: code,
    productName: name,
    color,
    size,
    layout,
    mrp,
    ourPrice,
    youSave: Math.max(0, roundRupees(mrp - ourPrice)),
    skuLine: buildSkuLine(code, layout, color, size),
    barcodeDots,
  };

  return {
    id: rowId,
    raw,
    status: copies === 0 ? 'skipped' : 'ready',
    errors: [],
    copies,
    copiesText,
    tag,
  };
}

export function validateRows(rows: RawRow[]): ValidatedRow[] {
  return rows.map((r) => validateRow(r));
}

/** Change the Copies of an already validated row (UI edit) and re-validate it, keeping its id. */
export function withCopies(row: ValidatedRow, copiesText: string): ValidatedRow {
  return validateRow({ ...row.raw, copies: copiesText }, row.id);
}

export interface Summary {
  total: number;
  ready: number;
  errors: number;
  skipped: number;
  /** Labels (= print pages) across all ready rows. */
  labels: number;
}

export function summarise(rows: ValidatedRow[]): Summary {
  const s: Summary = { total: rows.length, ready: 0, errors: 0, skipped: 0, labels: 0 };
  for (const r of rows) {
    if (r.status === 'ready') {
      s.ready += 1;
      s.labels += r.copies;
    } else if (r.status === 'error') {
      s.errors += 1;
    } else {
      s.skipped += 1;
    }
  }
  return s;
}
