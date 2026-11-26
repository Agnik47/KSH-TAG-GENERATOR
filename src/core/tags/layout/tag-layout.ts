/**
 * KSH tag layout model. A pure function from tag data to drawing instructions.
 *
 * The standard 125 × 75 mm tag (docs/03) is copied from reference/old_sku_tag_reference.py and
 * reference/new_sku_tag_reference.py and is never changed. Other label sizes use the fitted
 * layout in fitted-layout.ts (same content, sized to the label). Small labels (short side
 * under 40 mm, e.g. 51 × 32) use the Classic QR tag in qr-tag-layout.ts.
 *
 * Coordinates are in mm from the BOTTOM-LEFT of the design. Text y values are baselines.
 * Font sizes and line widths are in points. The renderer (PDF or SVG) only plays these back.
 */
import { BARCODE_HEIGHT_MM } from '../barcode/code128';
import { labelGeometry, type TagGeometry } from '../label/label';
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
import type { FontMetrics, Measure } from './font-metrics';
import { layoutFitted, missingCharsWarning } from './fitted-layout';
import { layoutQrTag } from './qr-tag-layout';
export { QR_TAG_MFG, QR_TAG_ORIGIN, mfdText } from './qr-tag-layout';

export * from './draw-ops';

export const DESIGN_W_MM = 125;
export const DESIGN_H_MM = 75;
export const MARGIN_MM = 6;
/** Max text width (design width minus both margins). */
export const TEXT_MAX_MM = DESIGN_W_MM - 2 * MARGIN_MM; // 113

const STANDARD_GEOMETRY = labelGeometry();

/** Shrink by 0.5 pt from `start` until the text fits `maxMm`, never below 6 pt. */
export function fitFontSize(text: string, font: FontId, start: number, measure: Measure, maxMm = TEXT_MAX_MM): number {
  let size = start;
  while (measure(text, font, size) * PT_MM > maxMm && size > 6) size -= 0.5;
  return size;
}

/**
 * Lay out one tag for a label. Without `geometry` this is the standard 125 × 75 KSH tag.
 * `tag.barcodeDots` must have been chosen for the same label (validateRow with validationFor(label)).
 * `date` sets the "Mfd" month on the small QR tag (default: now).
 */
export function layoutTag(tag: TagData, metrics: FontMetrics, geometry: TagGeometry = STANDARD_GEOMETRY, date?: Date): TagLayout {
  if (geometry.standard) return layoutStandard(tag, metrics);
  return geometry.symbology === 'qr' ? layoutQrTag(tag, metrics, geometry, date) : layoutFitted(tag, metrics, geometry);
}

/** The docs/03 tag, 125 × 75 mm. */
function layoutStandard(tag: TagData, metrics: FontMetrics): TagLayout {
  const { measure } = metrics;
  const ops: DrawOp[] = [];
  const warnings: string[] = [];
  const p = MARGIN_MM;
  const W = DESIGN_W_MM;
  const old = tag.layout === 'old';

  // Characters DejaVu cannot draw would print as empty boxes: warn before printing.
  const missing = missingCharsWarning(tag, metrics);
  if (missing) warnings.push(missing);

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
  ops.push(barcodeOp(tag.scanIdentifier, tag.barcodeDots, W / 2, 22, BARCODE_HEIGHT_MM));

  centred(tag.scanIdentifier, 17.5, 'B', 9);
  ops.push({ kind: 'line', x1: p, y1: 15, x2: W - p, y2: 15, widthPt: 0.4 });
  centred(old ? FOOTER_OLD : FOOTER_NEW, 11.5, 'R', 5.6);
  centred(FOOTER_2, 8, 'R', 5.6);

  return { ops, warnings };
}
