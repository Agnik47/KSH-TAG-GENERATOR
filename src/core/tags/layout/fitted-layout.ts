/**
 * Tag layouts for label sizes other than the standard 125 × 75 mm tag.
 *
 *  - Fitted (short side ≥ 40 mm): the same content as the KSH tag (header, product, SKU line,
 *    MRP / our price, barcode, code, footer). Text is sized down together until everything fits
 *    with a barcode at least 8 mm tall; the store header and "You save" are dropped only if needed.
 *  - Small labels (short side < 40 mm, e.g. 51 × 32) use the QR tag in qr-tag-layout.ts instead.
 *
 * Same coordinate system as the standard layout: mm from the bottom-left of the design.
 */
import { encodeCode128, neededWidthMm } from '../barcode/code128';
import type { TagGeometry } from '../label/label';
import type { TagData } from '../types';
import {
  FOOTER_2,
  FOOTER_NEW,
  FOOTER_OLD,
  PT_MM,
  barcodeOp,
  formatMrp,
  formatRupees,
  type DrawOp,
  type FontId,
  type TagLayout,
} from './draw-ops';
import type { FontMetrics } from './font-metrics';

/** DejaVu Sans: height above the baseline used by capitals/digits, and the descender, in em. */
const ASC = 0.76;
const DESC = 0.24;
const mmOf = (pt: number) => pt * PT_MM;

/** Barcode height limits (mm). Below MIN the scale is reduced further. */
const BAR_MAX_FITTED = 12;
const BAR_MIN_FITTED = 8;

const MIN_TEXT_PT = 5;
const MIN_SMALL_PT = 4;
/** Footer lines wrap at " | " rather than go below this size. */
const MIN_FOOTER_PT = 4.5;
const SCALE_STEP = 0.025;
const MIN_SCALE = 0.5;
/** Text may grow up to this much on roomy labels, but only while the barcode keeps its full height. */
const MAX_SCALE = 1.4;

/** Greedy wrap of " | "-separated parts into lines that fit. */
function wrapParts(parts: string[], fits: (line: string) => boolean): string[] {
  const lines: string[] = [];
  for (const part of parts) {
    const last = lines[lines.length - 1];
    if (last !== undefined && fits(`${last}  |  ${part}`)) lines[lines.length - 1] = `${last}  |  ${part}`;
    else lines.push(part);
  }
  return lines;
}

/** Warning for characters DejaVu cannot draw (they would print as empty boxes), or null. */
export function missingCharsWarning(tag: TagData, metrics: FontMetrics): string | null {
  const missing = new Set([
    ...metrics.unsupportedChars(`${tag.productName}${tag.color}`, 'R'),
    ...metrics.unsupportedChars(tag.size, 'B'),
  ]);
  return missing.size > 0 ? `These characters cannot be printed: ${[...missing].join(' ')}` : null;
}

/** Small helpers bound to one tag being drawn. */
function canvas(metrics: FontMetrics) {
  const ops: DrawOp[] = [];
  const width = (t: string, f: FontId, size: number) => metrics.measure(t, f, size) * PT_MM;
  /** Largest size ≤ start (0.25 pt steps, not below min) at which `t` fits `max` mm. */
  const fit = (t: string, f: FontId, start: number, max: number, min: number) => {
    let size = Math.max(min, start);
    while (width(t, f, size) > max + 1e-9 && size > min) size = Math.max(min, Math.round((size - 0.25) * 100) / 100);
    return size;
  };
  const put = (t: string, f: FontId, size: number, x: number, y: number, gray = 0) => {
    const w = width(t, f, size);
    ops.push({ kind: 'text', text: t, x, y, font: f, size, gray, width: w });
    return w;
  };
  return { ops, width, fit, put };
}

function barcodeFitWarning(tag: TagData, g: TagGeometry): string | null {
  const need = neededWidthMm(encodeCode128(tag.scanIdentifier).modules, tag.barcodeDots);
  return need > g.barcodeRoomMm + 1e-6 ? 'The barcode is wider than this label' : null;
}

interface Attempt extends TagLayout {
  barcodeH: number;
}

/** One try of the fitted layout at text scale `s`. `level` 1 drops the header, 2 also drops "You save". */
function tryFitted(tag: TagData, metrics: FontMetrics, g: TagGeometry, s: number, level: number): Attempt {
  const { w: W, h: H, marginMm: p } = g;
  const maxW = W - 2 * p;
  const { ops, width, fit, put } = canvas(metrics);
  const warnings: string[] = [];
  const old = tag.layout === 'old';

  // ---- top block, from the top edge down -------------------------------------------------
  let y = H - p;
  /** Next baseline for a line of `size` pt; moves the cursor below it. */
  const line = (size: number) => {
    const base = y - mmOf(size) * ASC;
    y = base - mmOf(size) * DESC;
    return base;
  };
  const gap = (mm: number) => {
    y -= mm * s;
  };

  if (level < 1) {
    const size = fit('KIDS SURPLUS HUB', 'B', 8 * s, maxW, MIN_SMALL_PT);
    put('KIDS SURPLUS HUB', 'B', size, p, line(size));
    gap(1.4);
  }

  const productText = `Product : ${tag.productName}`;
  const productSize = fit(productText, 'R', (old ? 9 : 10) * s, maxW, MIN_TEXT_PT);
  if (put(productText, 'R', productSize, p, line(productSize)) > maxW + 1e-6) {
    warnings.push('Product name is wider than the tag');
  }
  gap(1);

  if (old) {
    const prefix = `SKU : ${tag.scanIdentifier}  |  Color : ${tag.color}  |  Size : `;
    const total = (k: number) => width(prefix, 'R', 9 * s * k) + width(tag.size, 'B', 11 * s * k);
    let k = 1;
    while (total(k) > maxW + 1e-9 && 9 * s * k > MIN_TEXT_PT) k -= 0.025;
    const base = line(11 * s * k);
    const prefixW = put(prefix, 'R', 9 * s * k, p, base);
    put(tag.size, 'B', 11 * s * k, p + prefixW, base);
    if (total(k) > maxW + 1e-6) warnings.push('SKU line is wider than the tag');
  } else {
    const skuText = `SKU : ${tag.scanIdentifier}`;
    const size = fit(skuText, 'R', 9 * s, maxW, MIN_TEXT_PT);
    if (put(skuText, 'R', size, p, line(size)) > maxW + 1e-6) warnings.push('SKU line is wider than the tag');
  }
  gap(2.4);

  const mrpText = formatMrp(tag.mrp);
  const priceText = formatRupees(tag.ourPrice);
  const saveText = `You save ${formatRupees(tag.youSave)}`;
  const taxText = '(Inclusive of all Taxes)';
  const showSave = level < 2;

  /** MRP in 35% grey with the black strike-through line (scaled from docs/03: 1.2 pt, 2.4 mm up at 16 pt). */
  const mrp = (x: number, base: number, size: number) => {
    const w = put(mrpText, 'R', size, x, base, 0.35);
    const k = size / 16;
    const ly = base + 2.4 * k;
    ops.push({ kind: 'line', x1: x - PT_MM * k, y1: ly, x2: x + w + PT_MM * k, y2: ly, widthPt: Math.max(0.6, 1.2 * k) });
  };

  if (W >= 60) {
    // Two columns, like the standard tag: MRP on the left, our price on the right.
    const rx = W / 2 + 2 * s;
    const leftW = rx - p - 2 * s;
    const rightW = W - p - rx;
    const labelSize = Math.min(
      fit('MAXIMUM RETAIL PRICE', 'B', 8.5 * s, leftW, MIN_SMALL_PT),
      fit('OUR PRICE', 'B', 8.5 * s, rightW, MIN_SMALL_PT),
    );
    const labelBase = line(labelSize);
    put('MAXIMUM RETAIL PRICE', 'B', labelSize, p, labelBase);
    put('OUR PRICE', 'B', labelSize, rx, labelBase);

    const priceSize = fit(priceText, 'B', 26 * s, rightW, 8);
    const mrpSize = fit(mrpText, 'R', 16 * s, leftW, 6);
    const priceBase = labelBase - mmOf(labelSize) * DESC - 1.6 * s - mmOf(priceSize) * ASC;
    const mrpBase = priceBase + 1.5 * s;
    mrp(p, mrpBase, mrpSize);
    put(priceText, 'B', priceSize, rx, priceBase);

    const taxSize = fit(taxText, 'R', 6.5 * s, leftW, MIN_SMALL_PT);
    const taxBase = mrpBase - mmOf(mrpSize) * DESC - 1.2 * s - mmOf(taxSize) * ASC;
    put(taxText, 'R', taxSize, p, taxBase);
    y = taxBase - mmOf(taxSize) * DESC;

    if (showSave) {
      const saveSize = fit(saveText, 'R', 7.5 * s, rightW, MIN_SMALL_PT);
      const saveBase = priceBase - 1.5 * s - mmOf(saveSize) * ASC;
      put(saveText, 'R', saveSize, rx, saveBase);
      y = Math.min(y, saveBase - mmOf(saveSize) * DESC);
    } else {
      y = Math.min(y, priceBase - mmOf(priceSize) * DESC);
    }
  } else {
    // Narrow tag: MRP block, then our price block, one under the other.
    const labelSize = fit('MAXIMUM RETAIL PRICE', 'B', 8.5 * s, maxW, MIN_SMALL_PT);
    put('MAXIMUM RETAIL PRICE', 'B', labelSize, p, line(labelSize));
    gap(0.8);
    const mrpSize = fit(mrpText, 'R', 16 * s, maxW, 6);
    mrp(p, line(mrpSize), mrpSize);
    gap(0.4);
    const taxSize = fit(taxText, 'R', 6.5 * s, maxW, MIN_SMALL_PT);
    put(taxText, 'R', taxSize, p, line(taxSize));
    gap(2);
    put('OUR PRICE', 'B', labelSize, p, line(labelSize));
    gap(0.8);
    const priceSize = fit(priceText, 'B', 26 * s, maxW, 8);
    put(priceText, 'B', priceSize, p, line(priceSize));
    if (showSave) {
      gap(0.4);
      const saveSize = fit(saveText, 'R', 7.5 * s, maxW, MIN_SMALL_PT);
      put(saveText, 'R', saveSize, p, line(saveSize));
    }
  }
  const topBottom = y;

  // ---- bottom block, from the bottom edge up ---------------------------------------------
  // Footer: two lines, shrunk to fit; on narrow tags each line wraps at " | " instead.
  const footer = [old ? FOOTER_OLD : FOOTER_NEW, FOOTER_2];
  let footerSize = Math.min(...footer.map((l) => fit(l, 'R', 5.6 * s, maxW, MIN_FOOTER_PT)));
  let footerLines = footer;
  if (footer.some((l) => width(l, 'R', footerSize) > maxW + 1e-6)) {
    footerSize = Math.max(MIN_FOOTER_PT, Math.min(5.6, 5.6 * s));
    footerLines = footer.flatMap((l) => wrapParts(l.split('  |  '), (t) => width(t, 'R', footerSize) <= maxW));
    footerSize = Math.min(...footerLines.map((l) => fit(l, 'R', footerSize, maxW, MIN_SMALL_PT)));
  }
  if (footerLines.some((l) => width(l, 'R', footerSize) > maxW + 1e-6)) warnings.push('Footer is wider than the tag');
  const centre = (t: string, f: FontId, size: number, base: number) => put(t, f, size, (W - width(t, f, size)) / 2, base);

  let footerBase = p + mmOf(footerSize) * DESC;
  [...footerLines].reverse().forEach((l, i) => {
    if (i > 0) footerBase += mmOf(footerSize) * 1.6 + 0.4 * s;
    centre(l, 'R', footerSize, footerBase);
  });
  const dividerY = footerBase + mmOf(footerSize) * ASC + 1.6 * s;
  ops.push({ kind: 'line', x1: p, y1: dividerY, x2: W - p, y2: dividerY, widthPt: Math.max(0.3, 0.4 * s) });

  const codeSize = fit(tag.scanIdentifier, 'B', 9 * s, maxW, MIN_TEXT_PT);
  const codeBase0 = dividerY + 1.6 * s + mmOf(codeSize) * DESC;
  const barBottom0 = codeBase0 + mmOf(codeSize) * ASC + 2 * s;
  const avail = topBottom - 2.5 * s - barBottom0;
  const barcodeH = Math.min(BAR_MAX_FITTED, avail);
  // Spare room goes half above, half below the barcode + code pair.
  const lift = Math.max(0, (avail - barcodeH) / 2);
  centre(tag.scanIdentifier, 'B', codeSize, codeBase0 + lift);
  ops.push(barcodeOp(tag.scanIdentifier, tag.barcodeDots, W / 2, barBottom0 + lift, Math.max(barcodeH, 1)));

  return { ops, warnings, barcodeH };
}

/** Full KSH content sized to the label. */
export function layoutFitted(tag: TagData, metrics: FontMetrics, g: TagGeometry): TagLayout {
  // Roomy labels: grow the text while the barcode keeps its full height.
  for (let s = MAX_SCALE; s > 1 + 1e-9; s -= SCALE_STEP) {
    const a = tryFitted(tag, metrics, g, s, 0);
    if (a.barcodeH >= BAR_MAX_FITTED - 1e-9) return finish(a, tag, metrics, g, 0);
  }
  let last: Attempt | null = null;
  for (let level = 0; level <= 2; level++) {
    for (let s = 1; s >= MIN_SCALE - 1e-9; s -= SCALE_STEP) {
      last = tryFitted(tag, metrics, g, s, level);
      if (last.barcodeH >= BAR_MIN_FITTED) return finish(last, tag, metrics, g, level);
    }
  }
  const result = finish(last!, tag, metrics, g, 2);
  result.warnings.push(
    `Too much on this label: the barcode is only ${Math.max(0, last!.barcodeH).toFixed(1)} mm tall. Use a bigger label.`,
  );
  return result;
}

function finish(a: Attempt, tag: TagData, metrics: FontMetrics, g: TagGeometry, level: number): TagLayout {
  const warnings = [...a.warnings];
  const missing = missingCharsWarning(tag, metrics);
  if (missing) warnings.unshift(missing);
  const fitW = barcodeFitWarning(tag, g);
  if (fitW) warnings.push(fitW);
  if (level >= 1) warnings.push(`Store name${level >= 2 ? ' and "You save"' : ''} left out to fit this label`);
  return { ops: a.ops, warnings };
}
