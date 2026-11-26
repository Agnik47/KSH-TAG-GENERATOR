/**
 * The small QR tag ("Classic", chosen from docs/TEST_CODE/QR_Design_1_Classic.pdf) for labels
 * with a short side under 40 mm, e.g. 51 × 32 mm. Same design for old and new SKUs.
 *
 *   KIDS SURPLUS HUB            (bold, letter-spaced)
 *   ───────────────────────     (thin rule)
 *   Product name                (bold)
 *   [QR]   Size: 0M – 2Y        (old SKUs only)
 *   [QR]   MRP ₹1190.00         (struck through)
 *   [QR]   (Incl. of all taxes)
 *   [QR]   ₹595                 (large, bold)
 *   [QR]   Mfd: Nov-26          (month the tag is made)
 *          15-M-PNT-MKI-26-Q20-HYS-11   (code, bold, centred)
 *   Mfg/Mkt: K.L. Pvt. Ltd. Bengaluru-67  |  Country of Origin: INDIA
 *
 * Owner's design of 26 Nov 2026 (docs/TEST_CODE/KSH_QR_51x32_MRP_SAMPLE.pdf): "PRICE" became
 * "MRP" with the tax line, "You save" was replaced by Mfd, and the legal footer from the old
 * Wishkaro label was added. The QR code itself is unchanged.
 *
 * Landscape labels put the QR left of the prices; portrait labels stack them, centred.
 * Black only (no grey): thermal printers dither grey. The QR keeps ≥ 4 squares of white around it.
 */
import { QR_QUIET_MODULES } from '../barcode/qr';
import type { TagGeometry } from '../label/label';
import type { TagData } from '../types';
import { PT_MM, formatMrp, formatRupees, qrOp, type DrawOp, type FontId, type TagLayout } from './draw-ops';
import type { FontMetrics } from './font-metrics';
import { missingCharsWarning } from './fitted-layout';

export const STORE_NAME = 'KIDS SURPLUS HUB';
/** Legal lines from the old Wishkaro label, printed at the bottom of the small QR tag. */
export const QR_TAG_MFG = 'Mfg/Mkt: K.L. Pvt. Ltd. Bengaluru-67';
export const QR_TAG_ORIGIN = 'Country of Origin: INDIA';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mfd: Nov-26": the month (and 2-digit year) the tag is made, in the computer's local time. */
export function mfdText(date: Date): string {
  return `Mfd: ${MONTHS[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
}

const EDGE = 2.2; // margin to the label edge (mm)
const ASC = 0.76; // DejaVu cap/digit height (em)
const DESC = 0.24; // DejaVu descender (em)
const STORE_TRACK = 0.6; // letter spacing of the store name (pt)
const FOOTER_PT = 4.2; // legal footer size (pt)
const FOOTER_MIN_PT = 3.4;

interface Line {
  size: number;
  after?: number;
  draw: (x: number, base: number) => void;
  /** Width (mm), for centring on portrait tags. */
  width: number;
}

export function layoutQrTag(tag: TagData, metrics: FontMetrics, g: TagGeometry, date: Date = new Date()): TagLayout {
  const { w: W, h: H } = g;
  const portrait = W < H;
  const ops: DrawOp[] = [];
  const warnings: string[] = [];
  const missing = missingCharsWarning(tag, metrics);
  if (missing) warnings.push(missing);

  const cap = (size: number) => size * PT_MM * ASC;
  const desc = (size: number) => size * PT_MM * DESC;
  const width = (t: string, f: FontId, size: number, track = 0) => (metrics.measure(t, f, size) + track * t.length) * PT_MM;
  const fit = (t: string, f: FontId, start: number, max: number, min: number, track = 0) => {
    let size = start;
    while (width(t, f, size, track) > max + 1e-9 && size > min) size = Math.max(min, Math.round((size - 0.25) * 100) / 100);
    return size;
  };
  const clip = (t: string, f: FontId, size: number, max: number) => {
    if (width(t, f, size) <= max + 1e-9) return t;
    while (t.length > 1 && width(`${t}…`, f, size) > max) t = t.slice(0, -1).trimEnd();
    return `${t}…`;
  };
  const put = (t: string, f: FontId, size: number, x: number, y: number, track = 0) => {
    const w = width(t, f, size, track);
    ops.push({ kind: 'text', text: t, x, y, font: f, size, gray: 0, width: w, ...(track ? { track } : {}) });
    return w;
  };
  /** Up to two lines, shrinking from `size` to `min`; the last line gets "…" if still too long. */
  const wrap2 = (t: string, f: FontId, size: number, max: number, min: number) => {
    const split = (s: number) => {
      const lines = [''];
      for (const word of t.split(' ')) {
        const cur = lines[lines.length - 1];
        const next = cur ? `${cur} ${word}` : word;
        if (!cur || width(next, f, s) <= max) lines[lines.length - 1] = next;
        else lines.push(word);
      }
      return lines;
    };
    let s = size;
    let lines = split(s);
    while ((lines.length > 2 || lines.some((l) => width(l, f, s) > max)) && s > min) {
      s = Math.round((s - 0.25) * 100) / 100;
      lines = split(s);
    }
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
    return { size: s, lines: lines.map((l) => clip(l, f, s, max)) };
  };

  const textW = W - 2 * EDGE;
  const alignX = (w: number) => (portrait ? (W - w) / 2 : EDGE);

  // ---- Store name + rule ------------------------------------------------------------------
  const storeSize = fit(STORE_NAME, 'B', 5.2, textW, 4, STORE_TRACK);
  const storeBase = H - EDGE - cap(storeSize);
  put(STORE_NAME, 'B', storeSize, alignX(width(STORE_NAME, 'B', storeSize, STORE_TRACK)), storeBase, STORE_TRACK);
  const ruleY = storeBase - 1.1;
  ops.push({ kind: 'line', x1: EDGE, y1: ruleY, x2: W - EDGE, y2: ruleY, widthPt: 0.5 });

  // ---- Product name (one line on landscape tags, up to two on portrait tags) ---------------
  let nameBottom: number;
  if (portrait) {
    const name = wrap2(tag.productName, 'B', 7, textW, 5);
    let y = ruleY - 1.2;
    for (const l of name.lines) {
      const base = y - cap(name.size);
      put(l, 'B', name.size, alignX(width(l, 'B', name.size)), base);
      y = base - desc(name.size) - 0.35;
    }
    nameBottom = y + 0.35;
    if (name.lines.some((l) => l.endsWith('…'))) warnings.push('Product name shortened to fit the small tag');
  } else {
    const size = fit(tag.productName, 'B', 7, textW, 5);
    const name = clip(tag.productName, 'B', size, textW);
    const base = ruleY - 1.2 - cap(size);
    put(name, 'B', size, EDGE, base);
    nameBottom = base - desc(size);
    if (name !== tag.productName) warnings.push('Product name shortened to fit the small tag');
  }

  // ---- Legal footer along the bottom (one line; two lines on narrow portrait tags) ---------
  const footerOne = `${QR_TAG_MFG}  |  ${QR_TAG_ORIGIN}`;
  const footerLines = width(footerOne, 'R', FOOTER_MIN_PT) <= textW + 1e-9 ? [footerOne] : [QR_TAG_MFG, QR_TAG_ORIGIN];
  const footerSize = Math.min(...footerLines.map((l) => fit(l, 'R', FOOTER_PT, textW, FOOTER_MIN_PT)));
  let footerTop = EDGE - 0.6;
  for (const l of [...footerLines].reverse()) {
    const base = footerTop + desc(footerSize);
    put(l, 'R', footerSize, (W - width(l, 'R', footerSize)) / 2, base);
    footerTop = base + cap(footerSize) + 0.4;
  }
  footerTop -= 0.4;

  // ---- Code above the footer ----------------------------------------------------------------
  const codeSize = fit(tag.scanIdentifier, 'B', 6, textW, 4.5);
  const codeBase = footerTop + 1.0 + desc(codeSize);
  const codeW = put(tag.scanIdentifier, 'B', codeSize, (W - width(tag.scanIdentifier, 'B', codeSize)) / 2, codeBase);
  if (codeW > textW + 1e-6) warnings.push('The code text is wider than the tag');

  // ---- QR + prices in the band between the name and the code --------------------------------
  const top = nameBottom - 1.0;
  const bottom = codeBase + cap(codeSize) + 1.0;
  const qr = qrOp(tag.scanIdentifier, tag.barcodeDots, 0, 0); // positioned below
  const q = qr.size;
  const quiet = QR_QUIET_MODULES * qr.module;
  const colGap = Math.max(2.6, quiet + 0.3);

  const colW = portrait ? textW : W - EDGE - (EDGE + 0.3 + q + colGap);
  const old = tag.layout === 'old';
  const sizeText = `Size: ${tag.size}`;
  const priceText = `MRP ${formatMrp(tag.mrp)}`;
  const taxText = '(Incl. of all taxes)';
  const ourText = formatRupees(tag.ourPrice);
  const mfd = mfdText(date);
  // Old SKUs add a Size line: the big price and the gaps are a little smaller so the band keeps air.
  const withSize = old && tag.size !== '';
  // (Upright tags stack the QR above the text, so they are a touch tighter still.)
  const bigPt = withSize ? (portrait ? 11 : 12) : 14;
  const gap = withSize ? (portrait ? 0.45 : 0.6) : 1;
  const lines: Line[] = [];
  if (withSize) {
    const s = fit(sizeText, 'B', 5.6, colW, 4.5);
    lines.push({ size: s, after: gap, width: width(sizeText, 'B', s), draw: (x, b) => put(sizeText, 'B', s, x, b) });
  }
  {
    const s = fit(priceText, 'R', 5.5, colW, 4.5);
    lines.push({
      size: s,
      after: 0.45,
      width: width(priceText, 'R', s),
      draw: (x, b) => {
        // MRP struck through; the big price below is what the customer pays.
        const w = put(priceText, 'R', s, x, b);
        const ly = b + cap(s) * 0.42;
        ops.push({ kind: 'line', x1: x - 0.2, y1: ly, x2: x + w + 0.2, y2: ly, widthPt: Math.max(0.45, s * 0.09) });
      },
    });
  }
  {
    const s = fit(taxText, 'R', 4.2, colW, 3.6);
    lines.push({ size: s, after: gap, width: width(taxText, 'R', s), draw: (x, b) => put(taxText, 'R', s, x, b) });
  }
  {
    const s = fit(ourText, 'B', bigPt, colW, 9);
    lines.push({ size: s, after: gap * 0.8, width: width(ourText, 'B', s), draw: (x, b) => put(ourText, 'B', s, x, b) });
  }
  {
    // Mfd takes the place "You save" had: small, regular weight.
    const s = fit(mfd, 'R', 4.6, colW, 3.6);
    lines.push({ size: s, width: width(mfd, 'R', s), draw: (x, b) => put(mfd, 'R', s, x, b) });
  }
  const blockH = lines.reduce((h, l, i) => h + cap(l.size) + desc(l.size) + (i < lines.length - 1 ? (l.after ?? 0) : 0), 0);
  const drawLines = (x: (l: Line) => number, startTop: number) => {
    let y = startTop;
    for (const l of lines) {
      const base = y - cap(l.size);
      l.draw(x(l), base);
      y = base - desc(l.size) - (l.after ?? 0);
    }
  };

  const band = top - bottom;
  if (portrait) {
    const gap = Math.max(1.6, quiet + 0.4);
    const groupH = q + gap + blockH;
    // Centred in the band, but never so high that the name runs into the QR's white border.
    const groupTop = Math.min(bottom + (band + groupH) / 2, nameBottom - quiet - 0.2);
    ops.push(qrOp(tag.scanIdentifier, tag.barcodeDots, (W - q) / 2, groupTop - q));
    drawLines((l) => (W - l.width) / 2, groupTop - q - gap);
    if (groupTop - groupH < bottom - 1e-6) warnings.push('Too much on this small tag; check the preview');
  } else {
    const qx = EDGE + 0.3;
    ops.push(qrOp(tag.scanIdentifier, tag.barcodeDots, qx, bottom + (band - q) / 2));
    drawLines(() => qx + q + colGap, (top + bottom + blockH) / 2);
    if (q > band + 1e-6 || blockH > band + 1e-6) warnings.push('Too much on this small tag; check the preview');
  }

  return { ops, warnings };
}
