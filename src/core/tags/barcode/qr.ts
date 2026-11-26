/**
 * QR codes for small labels (e.g. 51 × 32 mm), where long SKU codes do not fit as a line barcode.
 * The QR holds only the ScanIdentifier, exactly what the line barcode holds, so Shopify POS
 * matches it to the product's Barcode field. Error correction level M (15%).
 */
import bwipjs from 'bwip-js/browser';
import { DOT_MM } from './code128';

/** White border needed around a QR code, in squares. */
export const QR_QUIET_MODULES = 4;
/** Smallest square we print: 5 dots = 0.42 mm (phone cameras read ≥ 0.4 mm reliably). */
export const MIN_QR_DOTS = 5;
/** Largest square: 8 dots = 0.68 mm. */
export const MAX_QR_DOTS = 8;
/** Preferred QR size (mm): what scanned well in the 51 × 32 tests. */
export const QR_TARGET_MM = 12.5;

export interface QrMatrix {
  /** Squares per side. */
  n: number;
  /** Row-major, row 0 at the top; true = dark. */
  dark: boolean[];
}

const cache = new Map<string, QrMatrix>();

/** Encode a value as a QR code (bwip-js, error correction M). Throws if it cannot be encoded. */
export function encodeQr(value: string): QrMatrix {
  const hit = cache.get(value);
  if (hit) return hit;
  const raw = bwipjs.raw('qrcode', value, 'eclevel=M') as Array<{ pixs?: number[]; pixx?: number }>;
  const { pixs, pixx } = raw[0] ?? {};
  if (!pixs || !pixx) throw new Error('QR code could not be encoded');
  const m = { n: pixx, dark: pixs.map((v) => v === 1) };
  cache.set(value, m);
  return m;
}

/**
 * Square size (printer dots) for a QR with `n` squares per side: close to QR_TARGET_MM, never
 * below MIN_QR_DOTS, and no bigger than `roomMm`. Null when even the smallest squares do not fit.
 */
export function chooseQrDots(n: number, roomMm: number): number | null {
  let dots = Math.min(MAX_QR_DOTS, Math.max(MIN_QR_DOTS, Math.round(QR_TARGET_MM / n / DOT_MM)));
  while (dots >= MIN_QR_DOTS && n * dots * DOT_MM > roomMm + 1e-9) dots--;
  return dots >= MIN_QR_DOTS ? dots : null;
}

/** QR side length (mm) at a square size in dots. */
export function qrSizeMm(n: number, dots: number): number {
  return n * dots * DOT_MM;
}
