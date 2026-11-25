import { describe, expect, it } from 'vitest';
import { DOT_MM } from '@/core/tags/barcode/code128';
import { validateRow } from '@/core/tags/csv/validate';
import {
  PT_MM,
  fitFontSize,
  formatMrp,
  formatRupees,
  layoutTag,
  type BarsOp,
  type DrawOp,
  type LineOp,
  type TextOp,
} from '@/core/tags/layout/tag-layout';
import type { RawRow, TagData } from '@/core/tags/types';
import { measure, metrics } from '../helpers/fixtures';

const tagOf = (over: Partial<RawRow>): TagData =>
  validateRow({
    line: 2,
    scanIdentifier: '15-M-PNT-MKI-26-Q20-HYS-11',
    productName: "Men's Casual Pants",
    color: '',
    size: '',
    mrp: '1190',
    ourPrice: '595',
    copies: '1',
    ...over,
  }).tag!;

const NEW = tagOf({});
const OLD = tagOf({
  scanIdentifier: 'bt624y',
  productName: 'Baby Boys Casual T-shirt Shorts',
  color: 'Yellow',
  size: '0M – 2Y',
  mrp: '1749',
  ourPrice: '259',
});

const texts = (ops: DrawOp[]) => ops.filter((o): o is TextOp => o.kind === 'text');
const find = (ops: DrawOp[], t: string) => texts(ops).find((o) => o.text === t)!;

describe('formatting', () => {
  it('MRP with 2 decimals, our price whole', () => {
    expect(formatMrp(1190)).toBe('₹1190.00');
    expect(formatMrp(998.5)).toBe('₹998.50');
    expect(formatRupees(595)).toBe('₹595');
  });
});

describe('new (KSH Surplus) layout', () => {
  const { ops, warnings } = layoutTag(NEW, metrics);

  it('places every element as in docs/03', () => {
    expect(warnings).toEqual([]);
    expect(find(ops, 'KIDS SURPLUS HUB')).toMatchObject({ x: 6, y: 69, font: 'B', size: 8 });
    expect(find(ops, "Product : Men's Casual Pants")).toMatchObject({ x: 6, y: 63, font: 'R', size: 10 });
    expect(find(ops, 'SKU : 15-M-PNT-MKI-26-Q20-HYS-11')).toMatchObject({ x: 6, y: 57.5, font: 'R', size: 9 });
    expect(find(ops, 'MAXIMUM RETAIL PRICE')).toMatchObject({ x: 6, y: 50, font: 'B', size: 8.5 });
    expect(find(ops, '₹1190.00')).toMatchObject({ x: 6, y: 42, font: 'R', size: 16, gray: 0.35 });
    expect(find(ops, '(Inclusive of all Taxes)')).toMatchObject({ x: 6, y: 37.5, font: 'R', size: 6.5 });
    expect(find(ops, 'OUR PRICE')).toMatchObject({ x: 66.5, y: 50, font: 'B', size: 8.5 });
    expect(find(ops, '₹595')).toMatchObject({ x: 66.5, y: 40.5, font: 'B', size: 26 });
    expect(find(ops, 'You save ₹595')).toMatchObject({ x: 66.5, y: 37, font: 'R', size: 7.5 });
    expect(find(ops, 'Marketed by: Kotemoda Lifestyle Pvt. Ltd.  |  Net Qty: 1 N')).toMatchObject({ y: 11.5, size: 5.6 });
    expect(find(ops, 'Customer care: 9972769817  |  care@wishkaro.com')).toMatchObject({ y: 8, size: 5.6 });
  });

  it('centres the code text and footers', () => {
    for (const t of ['15-M-PNT-MKI-26-Q20-HYS-11', 'Customer care: 9972769817  |  care@wishkaro.com']) {
      const op = texts(ops).find((o) => o.text === t && o.x !== 6)!;
      expect(op.x + op.width / 2).toBeCloseTo(62.5, 6);
    }
    expect(texts(ops).find((o) => o.text === '15-M-PNT-MKI-26-Q20-HYS-11')).toMatchObject({ y: 17.5, font: 'B', size: 9 });
  });

  it('strikes through the MRP: 1.2 pt, 2.4 mm above baseline, ±1 pt beyond the text', () => {
    const mrp = find(ops, '₹1190.00');
    const strike = ops.find((o): o is LineOp => o.kind === 'line' && o.widthPt === 1.2)!;
    expect(strike.y1).toBeCloseTo(44.4, 6);
    expect(strike.x1).toBeCloseTo(6 - PT_MM, 6);
    expect(strike.x2).toBeCloseTo(6 + mrp.width + PT_MM, 6);
  });

  it('divider line 6 → 119 at 15 mm, 0.4 pt', () => {
    expect(ops).toContainEqual({ kind: 'line', x1: 6, y1: 15, x2: 119, y2: 15, widthPt: 0.4 });
  });

  it('barcode: centred, bottom 22 mm, 12 mm tall, 3-dot module, x on a whole dot', () => {
    const bars = ops.find((o): o is BarsOp => o.kind === 'bars')!;
    expect(bars).toMatchObject({ y: 22, height: 12, dots: 3, value: '15-M-PNT-MKI-26-Q20-HYS-11' });
    expect(bars.width).toBeCloseTo(321 * 3 * DOT_MM, 6);
    expect(Math.abs(bars.x + bars.width / 2 - 62.5)).toBeLessThanOrEqual(DOT_MM / 2 + 1e-9);
    expect(Math.abs(bars.x / DOT_MM - Math.round(bars.x / DOT_MM))).toBeLessThan(1e-9);
  });
});

describe('old (Wishkaro) layout', () => {
  const { ops, warnings } = layoutTag(OLD, metrics);

  it('uses the old positions and footer', () => {
    expect(warnings).toEqual([]);
    expect(find(ops, 'Product : Baby Boys Casual T-shirt Shorts')).toMatchObject({ x: 6, y: 63.5, font: 'R', size: 9 });
    expect(find(ops, 'Marketed by: Kotemoda Lifestyle Pvt. Ltd.  |  Country of Origin: India  |  Net Qty: 1 N')).toBeTruthy();
    expect(find(ops, 'You save ₹1490')).toBeTruthy();
  });

  it('SKU line in R 9, then the size in B 11 right after it', () => {
    const prefix = find(ops, 'SKU : bt624y  |  Color : Yellow  |  Size : ');
    const size = find(ops, '0M – 2Y');
    expect(prefix).toMatchObject({ x: 6, y: 58, font: 'R', size: 9 });
    expect(size).toMatchObject({ y: 58, font: 'B', size: 11 });
    expect(size.x).toBeCloseTo(6 + prefix.width, 9);
  });

  it('short old code → 7-dot module', () => {
    expect(ops.find((o): o is BarsOp => o.kind === 'bars')!.dots).toBe(7);
  });
});

describe('product name shrink', () => {
  it('shrinks by 0.5 pt until it fits 113 mm, never below 6 pt', () => {
    const long = 'Product : ' + 'Extra Long Product Name '.repeat(3).trim();
    const size = fitFontSize(long, 'R', 10, measure);
    expect(size).toBeLessThan(10);
    expect(size).toBeGreaterThanOrEqual(6);
    expect(measure(long, 'R', size) * PT_MM).toBeLessThanOrEqual(113);
    expect(measure(long, 'R', size + 0.5) * PT_MM).toBeGreaterThan(113);
    expect(size * 2).toBe(Math.round(size * 2));
  });

  it('stops at 6 pt and warns when still too wide', () => {
    const { ops, warnings } = layoutTag(tagOf({ productName: 'W'.repeat(80) }), metrics);
    expect(texts(ops).find((o) => o.text.startsWith('Product : '))!.size).toBe(6);
    expect(warnings).toContain('Product name is wider than the tag even at 6 pt');
  });

  it('short names keep the full size', () => {
    expect(fitFontSize("Product : Men's Innerwear", 'R', 10, measure)).toBe(10);
  });
});
