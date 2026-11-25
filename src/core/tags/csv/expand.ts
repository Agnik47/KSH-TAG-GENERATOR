import Papa from 'papaparse';
import type { ExpandedRecord, TagData, ValidatedRow } from '../types';

export const EXPANDED_COLUMNS: Array<keyof ExpandedRecord> = [
  'ScanIdentifier',
  'ProductName',
  'Color',
  'Size',
  'MRP',
  'OurPrice',
  'YouSave',
  'SkuLine',
];

/** Format a rupee amount for the CSV: 1190 → "1190", 998.5 → "998.5". */
export function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/**
 * One tag per label, in input order: ready rows only, each repeated `copies` times.
 * `copiesOverride` = 1 gives the "Test print (1 each)" list.
 */
export function expandTags(rows: ValidatedRow[], copiesOverride?: number): TagData[] {
  const out: TagData[] = [];
  for (const r of rows) {
    if (r.status !== 'ready' || !r.tag) continue;
    const n = copiesOverride ?? r.copies;
    for (let i = 0; i < n; i++) out.push(r.tag);
  }
  return out;
}

export function toExpandedRecord(t: TagData): ExpandedRecord {
  return {
    ScanIdentifier: t.scanIdentifier,
    ProductName: t.productName,
    Color: t.color,
    Size: t.size,
    MRP: formatAmount(t.mrp),
    OurPrice: formatAmount(t.ourPrice),
    YouSave: formatAmount(t.youSave),
    SkuLine: t.skuLine,
  };
}

/**
 * Build the expanded "one row per label" CSV (docs/02 Output CSV), same shape as
 * samples/ksh_tags_sample_expanded_output.csv: UTF-8, CRLF line endings, trailing newline.
 */
export function toExpandedCsv(tags: TagData[]): string {
  const csv = Papa.unparse(
    { fields: EXPANDED_COLUMNS as string[], data: tags.map((t) => EXPANDED_COLUMNS.map((c) => toExpandedRecord(t)[c])) },
    { newline: '\r\n', quotes: false },
  );
  return csv + '\r\n';
}

/** `YYYY-MM-DD_HHmm` in local time. */
export function fileStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
}

/** `ksh-tags_<YYYY-MM-DD_HHmm>_<total labels>.csv` in local time. */
export function expandedCsvFileName(date: Date, totalLabels: number): string {
  return `ksh-tags_${fileStamp(date)}_${totalLabels}.csv`;
}

/** PDF names follow the same pattern: `ksh-tags_<kind>_<YYYY-MM-DD_HHmm>_<pages>.pdf`. */
export function pdfFileName(kind: 'print' | 'TEST-1-each' | 'preview', date: Date, pages: number): string {
  return `ksh-tags_${kind}_${fileStamp(date)}_${pages}.pdf`;
}

/** The empty input template (headers only), same as samples/ksh_tags_template.csv. */
export const TEMPLATE_CSV = 'ScanIdentifier,ProductName,Color,Size,MRP,OurPrice,Copies\r\n';
