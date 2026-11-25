/**
 * KSH tag layout model (docs/03). A pure function from tag data to drawing instructions.
 * Copied from reference/old_sku_tag_reference.py and reference/new_sku_tag_reference.py.
 *
 * Coordinates are in mm from the BOTTOM-LEFT of the landscape 125 × 75 mm design.
 * Text y values are baselines. Font sizes and line widths are in points.
 * The renderer (PDF or SVG) only plays these instructions back.
 */
import { BARCODE_HEIGHT_MM, DOT_MM, encodeCode128 } from '../barcode/code128';
import type { TagData } from '../types';
import type { FontMetrics, Measure } from './font-metrics';

export const DESIGN_W_MM = 125;
export const DESIGN_H_MM = 75;
export const MARGIN_MM = 6;
export const PT_MM = 25.4 / 72;
/** Max text width (design width minus both margins). */
export const TEXT_MAX_MM = DESIGN_W_MM - 2 * MARGIN_MM; // 113

export type FontId = 'R' | 'B';

export interface TextOp {
  kind: 'text';
  text: string;
  x: number;
  y: number;
  font: FontId;
  size: number;
  /** Fill grey level, 0 = black, 1 = white. */
  gray: number;
  /** Width of the text in mm (already measured). */
  width: number;
}

export interface LineOp {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Stroke width in points. Always black. */
  widthPt: number;
}

export interface BarsOp {
  kind: 'bars';
  /** Left edge of the first bar and bottom edge (mm). */
  x: number;
  y: number;
  height: number;
  /** Narrow-bar width in mm (whole printer dots). */
  module: number;
  dots: number;
  /** Each bar as [x offset from `x`, width], in mm. */
  bars: Array<[number, number]>;
  /** Total width of the symbol (mm), no quiet zones. */
  width: number;
  value: string;
}

export type DrawOp = TextOp | LineOp | BarsOp;

export interface TagLayout {
  ops: DrawOp[];
  /** Non-blocking notes, e.g. a line that is wider than the tag. */
  warnings: string[];
}

const FOOTER_OLD = 'Marketed by: Kotemoda Lifestyle Pvt. Ltd.  |  Country of Origin: India  |  Net Qty: 1 N';
const FOOTER_NEW = 'Marketed by: Kotemoda Lifestyle Pvt. Ltd.  |  Net Qty: 1 N';
const FOOTER_2 = 'Customer care: 9972769817  |  care@wishkaro.com';

export const RUPEE = '₹';

/** "₹1190.00" — MRP always with 2 decimals. */
export function formatMrp(mrp: number): string {
  return `${RUPEE}${mrp.toFixed(2)}`;
}

/** "₹595" — whole rupees. */
export function formatRupees(n: number): string {
  return `${RUPEE}${n.toFixed(0)}`;
}

/** Shrink by 0.5 pt from `start` until the text fits `maxMm`, never below 6 pt. */
export function fitFontSize(text: string, font: FontId, start: number, measure: Measure, maxMm = TEXT_MAX_MM): number {
  let size = start;
  while (measure(text, font, size) * PT_MM > maxMm && size > 6) size -= 0.5;
  return size;
}

export function layoutTag(tag: TagData, metrics: FontMetrics): TagLayout {
  const { measure } = metrics;
  const ops: DrawOp[] = [];
  const warnings: string[] = [];
  const p = MARGIN_MM;
  const W = DESIGN_W_MM;
  const old = tag.layout === 'old';

  // Characters DejaVu cannot draw would print as empty boxes: warn before printing.
  const missing = new Set([
    ...metrics.unsupportedChars(`${tag.productName}${tag.color}`, 'R'),
    ...metrics.unsupportedChars(tag.size, 'B'),
  ]);
  if (missing.size > 0) warnings.push(`These characters cannot be printed: ${[...missing].join(' ')}`);

  const wMm = (text: string, font: FontId, size: number) => measure(text, font, size) * PT_MM;
  const text = (t: string, x: number, y: number, font: FontId, size: number, gray = 0) => {
    const width = wMm(t, font, size);
    ops.push({ kind: 'text', text: t, x, y, font, size, gray, width });
    return width;
  };
  const centred = (t: string, y: number, font: FontId, size: number) => {
    const width = wMm(t, font, size);
    ops.push({ kind: 'text', text: t, x: W / 2 - width / 2, y, font, size, gray: 0, width });
  };

  // Header + product name.
  text('KIDS SURPLUS HUB', p, 69, 'B', 8);
  const productText = `Product : ${tag.productName}`;
  const productSize = fitFontSize(productText, 'R', old ? 9 : 10, measure);
  const productW = text(productText, p, old ? 63.5 : 63, 'R', productSize);
  if (productW > TEXT_MAX_MM + 1e-6) warnings.push('Product name is wider than the tag even at 6 pt');

  // SKU line.
  if (old) {
    const prefix = `SKU : ${tag.scanIdentifier}  |  Color : ${tag.color}  |  Size : `;
    const prefixW = text(prefix, p, 58, 'R', 9);
    const sizeW = text(tag.size, p + prefixW, 58, 'B', 11);
    if (prefixW + sizeW > TEXT_MAX_MM + 1e-6) warnings.push('SKU line is wider than the tag');
  } else {
    const w = text(`SKU : ${tag.scanIdentifier}`, p, 57.5, 'R', 9);
    if (w > TEXT_MAX_MM + 1e-6) warnings.push('SKU line is wider than the tag');
  }

  // MRP block (left).
  const y = 50;
  text('MAXIMUM RETAIL PRICE', p, y, 'B', 8.5);
  const mrpText = formatMrp(tag.mrp);
  const mrpW = text(mrpText, p, y - 8, 'R', 16, 0.35);
  // Strike-through: 1.2 pt black, from x − 1 pt to end + 1 pt, 2.4 mm above the baseline.
  ops.push({ kind: 'line', x1: p - PT_MM, y1: y - 8 + 2.4, x2: p + mrpW + PT_MM, y2: y - 8 + 2.4, widthPt: 1.2 });
  text('(Inclusive of all Taxes)', p, y - 12.5, 'R', 6.5);

  // Our price block (right).
  const rx = W / 2 + 4;
  text('OUR PRICE', rx, y, 'B', 8.5);
  text(formatRupees(tag.ourPrice), rx, y - 9.5, 'B', 26);
  text(`You save ${formatRupees(tag.youSave)}`, rx, y - 13, 'R', 7.5);

  // Barcode: centred, bottom at 22 mm, 12 mm tall. Left edge snapped to a whole printer dot.
  const enc = encodeCode128(tag.scanIdentifier);
  const moduleMm = tag.barcodeDots * DOT_MM;
  const bcWidth = enc.modules * moduleMm;
  const bx = Math.round((W - bcWidth) / 2 / DOT_MM) * DOT_MM;
  const bars: Array<[number, number]> = [];
  let off = 0;
  enc.sbs.forEach((m, i) => {
    if (i % 2 === 0) bars.push([off * moduleMm, m * moduleMm]);
    off += m;
  });
  ops.push({
    kind: 'bars',
    x: bx,
    y: 22,
    height: BARCODE_HEIGHT_MM,
    module: moduleMm,
    dots: tag.barcodeDots,
    bars,
    width: bcWidth,
    value: tag.scanIdentifier,
  });

  centred(tag.scanIdentifier, 17.5, 'B', 9);
  ops.push({ kind: 'line', x1: p, y1: 15, x2: W - p, y2: 15, widthPt: 0.4 });
  centred(old ? FOOTER_OLD : FOOTER_NEW, 11.5, 'R', 5.6);
  centred(FOOTER_2, 8, 'R', 5.6);

  return { ops, warnings };
}
