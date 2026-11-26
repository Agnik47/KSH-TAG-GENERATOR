/**
 * Drawing instructions shared by every tag layout and both renderers (PDF and SVG).
 * Coordinates are in mm from the BOTTOM-LEFT of the tag design; text y values are baselines.
 * Font sizes and line widths are in points.
 */
import { DOT_MM, encodeCode128 } from '../barcode/code128';
import { encodeQr } from '../barcode/qr';

export const PT_MM = 25.4 / 72;

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
  /** Width of the text in mm (already measured, letter spacing included). */
  width: number;
  /** Extra space after every character (pt), e.g. for a spaced-out store name. */
  track?: number;
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

/** A QR code: dark squares as horizontal runs. */
export interface MatrixOp {
  kind: 'matrix';
  /** Bottom-left corner (mm). */
  x: number;
  y: number;
  /** Square size in mm (whole printer dots). */
  module: number;
  dots: number;
  /** Squares per side. */
  n: number;
  /** Side length (mm), no quiet zone. */
  size: number;
  /** Dark runs as [row from the top, first column, length] in squares. */
  runs: Array<[number, number, number]>;
  value: string;
}

export type DrawOp = TextOp | LineOp | BarsOp | MatrixOp;

export interface TagLayout {
  ops: DrawOp[];
  /** Non-blocking notes, e.g. a line that is wider than the tag. */
  warnings: string[];
}

/** Footer lines (docs/03). */
export const FOOTER_OLD = 'Marketed by: Kotemoda Lifestyle Pvt. Ltd.  |  Country of Origin: India  |  Net Qty: 1 N';
export const FOOTER_NEW = 'Marketed by: Kotemoda Lifestyle Pvt. Ltd.  |  Net Qty: 1 N';
export const FOOTER_2 = 'Customer care: 9972769817  |  care@wishkaro.com';

export const RUPEE = '₹';

/** "₹1190.00" — MRP always with 2 decimals. */
export function formatMrp(mrp: number): string {
  return `${RUPEE}${mrp.toFixed(2)}`;
}

/** "₹595" — whole rupees. */
export function formatRupees(n: number): string {
  return `${RUPEE}${n.toFixed(0)}`;
}

/** Code 128 bars for `value`, horizontally centred on `centreX`, left edge snapped to a printer dot. */
export function barcodeOp(value: string, dots: number, centreX: number, y: number, height: number): BarsOp {
  const enc = encodeCode128(value);
  const moduleMm = dots * DOT_MM;
  const width = enc.modules * moduleMm;
  const x = Math.round((centreX - width / 2) / DOT_MM) * DOT_MM;
  const bars: Array<[number, number]> = [];
  let off = 0;
  enc.sbs.forEach((m, i) => {
    if (i % 2 === 0) bars.push([off * moduleMm, m * moduleMm]);
    off += m;
  });
  return { kind: 'bars', x, y, height, module: moduleMm, dots, bars, width, value };
}

/** QR code for `value` with its bottom-left corner at (x, y), snapped to printer dots. */
export function qrOp(value: string, dots: number, x: number, y: number): MatrixOp {
  const m = encodeQr(value);
  const moduleMm = dots * DOT_MM;
  const runs: Array<[number, number, number]> = [];
  for (let row = 0; row < m.n; row++) {
    for (let col = 0; col < m.n;) {
      if (!m.dark[row * m.n + col]) {
        col++;
        continue;
      }
      let end = col;
      while (end < m.n && m.dark[row * m.n + end]) end++;
      runs.push([row, col, end - col]);
      col = end;
    }
  }
  const snap = (v: number) => Math.round(v / DOT_MM) * DOT_MM;
  return { kind: 'matrix', x: snap(x), y: snap(y), module: moduleMm, dots, n: m.n, size: m.n * moduleMm, runs, value };
}
