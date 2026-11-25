/**
 * Shared types for KSH Tag Studio.
 *
 * Phase 1 (CSV upload) and Phase 2 (Shopify search) both produce `RawRow`s and feed them
 * through the same validate → layout → PDF pipeline. Nothing in `src/core` depends on
 * React, the DOM or Next.js, so it runs in the browser, in Node tests and on a server.
 */

/** "old" = Wishkaro styles (Color or Size filled); "new" = KSH Surplus (both empty). */
export type Layout = 'old' | 'new';

export type RowStatus = 'ready' | 'error' | 'skipped';

/** One input row, exactly as read (all strings, already trimmed). */
export interface RawRow {
  /** 1-based line number in the source file (header = line 1), or list position in Phase 2. */
  line: number;
  scanIdentifier: string;
  productName: string;
  color: string;
  size: string;
  mrp: string;
  ourPrice: string;
  /** Raw Copies text. `null` when the file has no Copies column (one row = one label). */
  copies: string | null;
}

/** Everything needed to draw one tag. Only built for rows without errors. */
export interface TagData {
  scanIdentifier: string;
  productName: string;
  color: string;
  size: string;
  layout: Layout;
  /** MRP as typed (number > 0). Printed with 2 decimals. */
  mrp: number;
  /** OurPrice rounded to whole rupees (half up). */
  ourPrice: number;
  /** MRP − ourPrice, whole rupees, never negative. */
  youSave: number;
  /** Text of the SKU line (for the expanded CSV); the tag draws Size in bold. */
  skuLine: string;
  /** Narrow-bar width in printer dots (7, 6, 5, 4 or 3). */
  barcodeDots: number;
}

export interface ValidatedRow {
  /** Stable id (React keys, selection). Survives Copies edits. */
  id: string;
  raw: RawRow;
  status: RowStatus;
  errors: string[];
  /** Copies to print (0 when skipped or in error). */
  copies: number;
  /** Copies as it should be shown: normalised ("011" → "11", empty → "1") when valid, raw text otherwise. */
  copiesText: string;
  tag: TagData | null;
}

/** One label in the "one row per label" export (docs/02 Output CSV). */
export interface ExpandedRecord {
  ScanIdentifier: string;
  ProductName: string;
  Color: string;
  Size: string;
  MRP: string;
  OurPrice: string;
  YouSave: string;
  SkuLine: string;
}
