import bwipjs from 'bwip-js/browser';

/** Zebra GX430t is 300 dpi: one printer dot in mm. */
export const DOT_MM = 25.4 / 300;

/** Narrow-bar widths tried, widest first (docs/03). */
export const MODULE_DOTS = [7, 6, 5, 4, 3] as const;

/** Thinnest narrow bar we ever print (3 dots = 0.254 mm). */
export const MIN_MODULE_DOTS = 3;

/** Barcode width + quiet zones must fit in this (mm). */
export const MAX_BARCODE_MM = 113;

/** Quiet zone on each side, in modules. */
export const QUIET_MODULES = 10;

/** Barcode height on the tag (mm). */
export const BARCODE_HEIGHT_MM = 12;

/** Code 128 can encode printable ASCII (we do not allow control characters on a price tag). */
export function isPrintableAscii(value: string): boolean {
  return /^[\x20-\x7E]+$/.test(value);
}

export interface EncodedBarcode {
  /** Alternating bar/space widths in modules, starting with a bar (incl. start, check and stop). */
  sbs: number[];
  /** Total width in modules (without quiet zones). */
  modules: number;
}

const cache = new Map<string, EncodedBarcode>();

/**
 * Encode a value as Code 128 (automatic code set) using bwip-js.
 * Throws if the value cannot be encoded.
 */
export function encodeCode128(value: string): EncodedBarcode {
  const hit = cache.get(value);
  if (hit) return hit;
  // Default options (parse/parsefnc off): the value is encoded literally, no ^NNN escapes.
  const raw = bwipjs.raw('code128', value, {}) as Array<{ sbs?: number[] }>;
  const sbs = raw[0]?.sbs;
  if (!sbs || sbs.length === 0) throw new Error('Barcode could not be encoded');
  const enc = { sbs: [...sbs], modules: sbs.reduce((a, b) => a + b, 0) };
  cache.set(value, enc);
  return enc;
}

/** Width in mm of the bars only (no quiet zones) at a given module size in dots. */
export function barcodeWidthMm(modules: number, dots: number): number {
  return modules * dots * DOT_MM;
}

/**
 * Choose the widest narrow-bar width (7…3 dots) for which
 * barcode width + 10-module quiet zones on both sides ≤ `roomMm` (113 mm on the standard tag).
 * Returns null when it does not fit even at 3 dots ("Barcode too long").
 */
export function chooseModuleDots(modules: number, roomMm: number = MAX_BARCODE_MM): number | null {
  for (const dots of MODULE_DOTS) {
    if (neededWidthMm(modules, dots) <= roomMm + 1e-9) return dots;
  }
  return null;
}

/** Barcode width including both quiet zones (mm). */
export function neededWidthMm(modules: number, dots: number): number {
  return (modules + 2 * QUIET_MODULES) * dots * DOT_MM;
}

/** Convenience: encode + choose. Returns null for module dots if too long. */
export function planBarcode(value: string, roomMm: number = MAX_BARCODE_MM): { enc: EncodedBarcode; dots: number | null } {
  const enc = encodeCode128(value);
  return { enc, dots: chooseModuleDots(enc.modules, roomMm) };
}
