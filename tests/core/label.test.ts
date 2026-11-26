import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { QUIET_MODULES } from '@/core/tags/barcode/code128';
import { QR_QUIET_MODULES } from '@/core/tags/barcode/qr';
import { expandTags, pdfFileName } from '@/core/tags/csv/expand';
import { parseTagCsv } from '@/core/tags/csv/parse';
import { ERR, validateRow, validateRows, validationFor } from '@/core/tags/csv/validate';
import {
  DEFAULT_LABEL,
  LABEL_PRESETS,
  checkCustomSize,
  labelFileTag,
  labelGeometry,
  parseLabel,
  type LabelSpec,
  type Orientation,
} from '@/core/tags/label/label';
import { PT_MM, layoutTag, mfdText, type BarsOp, type MatrixOp, type TextOp } from '@/core/tags/layout/tag-layout';
import { MM_PT, renderTagsPdf } from '@/core/tags/pdf/render-pdf';
import type { RawRow } from '@/core/tags/types';
import { barsToPng, decodeMatrixOp, decodePng } from '../helpers/barcode-raster';
import { fonts, metrics, readSample } from '../helpers/fixtures';

const L = (widthMm: number, lengthMm: number, orientation: Orientation = 'horizontal'): LabelSpec => ({
  widthMm,
  lengthMm,
  orientation,
});
const SMALL = L(51, 32);
const NOV_26 = new Date(2026, 10, 26);
const SAMPLE: RawRow[] = parseTagCsv(readSample('ksh_tags_sample_input.csv')).rows;
const LONG = '15-M-PNT-MKI-26-Q20-HYS-11';
const raw = (scanIdentifier: string, over: Partial<RawRow> = {}): RawRow => ({
  line: 2,
  scanIdentifier,
  productName: 'Baby Boys Casual T-shirt Shorts',
  color: 'Red',
  size: '0M – 2Y',
  mrp: '998',
  ourPrice: '282',
  copies: '1',
  ...over,
});

describe('label geometry', () => {
  it('the default is the docs/03 tag: 125 × 75 design, turned onto the 75 × 125 roll', () => {
    expect(labelGeometry(DEFAULT_LABEL)).toMatchObject({
      w: 125,
      h: 75,
      pageW: 75,
      pageH: 125,
      rotated: true,
      standard: true,
      compact: false,
      barcodeRoomMm: 113,
    });
  });

  it('51 × 32: horizontal is the label as printed; vertical is turned', () => {
    expect(labelGeometry(SMALL)).toMatchObject({ w: 51, h: 32, pageW: 51, pageH: 32, rotated: false, compact: true });
    expect(labelGeometry(L(51, 32, 'vertical'))).toMatchObject({ w: 32, h: 51, pageW: 51, pageH: 32, rotated: true });
    expect(labelGeometry(L(100, 50))).toMatchObject({ w: 100, h: 50, rotated: false, compact: false, standard: false });
    expect(labelGeometry(L(75, 125, 'vertical'))).toMatchObject({ w: 75, h: 125, rotated: false, standard: false });
  });

  it('custom sizes are checked against the printer', () => {
    expect(checkCustomSize(60, 40)).toBeNull();
    expect(checkCustomSize(110, 40)).toContain('104 mm');
    expect(checkCustomSize(10, 40)).toContain('20 mm');
    expect(checkCustomSize(NaN, 40)).toBeTruthy();
    expect(parseLabel({ widthMm: 51, lengthMm: 32, orientation: 'vertical' })).toEqual(L(51, 32, 'vertical'));
    expect(parseLabel({ widthMm: 500, lengthMm: 32, orientation: 'vertical' })).toBeNull();
    expect(parseLabel('nope')).toBeNull();
  });

  it('file names carry the size for non-standard labels only', () => {
    const d = new Date(2026, 10, 25, 9, 5);
    expect(pdfFileName('print', d, 3)).toBe('ksh-tags_print_2026-11-25_0905_3.pdf');
    expect(pdfFileName('print', d, 3, labelFileTag(L(51, 32, 'vertical')))).toBe(
      'ksh-tags_print_51x32mm-vertical_2026-11-25_0905_3.pdf',
    );
  });
});

describe('barcode fit per label', () => {
  it('51 × 32 prints a QR: every sample code fits, both directions (QR squares ~0.5–0.6 mm)', () => {
    for (const label of [SMALL, L(51, 32, 'vertical')]) {
      const rows = validateRows(SAMPLE, validationFor(label));
      expect(rows.every((r) => r.status === 'ready')).toBe(true);
    }
    const opts = validationFor(SMALL);
    expect(opts).toMatchObject({ symbology: 'qr' });
    expect(validateRow(raw(LONG), undefined, opts).tag!.barcodeDots).toBe(6); // 25 × 25 QR → 12.7 mm
    expect(validateRow(raw('bt539cfe'), undefined, opts).tag!.barcodeDots).toBe(7); // 21 × 21 QR → 12.4 mm
    // Far too much text for a QR on this label.
    expect(validateRow(raw('X'.repeat(200)), undefined, opts).errors[0]).toBe(`${ERR.barcodeTooLong} for a QR on 51 × 32 mm`);
  });

  it('long SKU codes still do not fit as a line barcode on narrow tags', () => {
    const long = validateRow(raw(LONG), undefined, validationFor(L(75, 125, 'vertical')));
    expect(long.errors[0]).toBe(`${ERR.barcodeTooLong} for 75 × 125 mm vertical (needs 87 mm, fits 67 mm)`);
  });

  it('100 × 50 fits every sample code; the standard label keeps the plain message', () => {
    expect(validateRows(SAMPLE, validationFor(L(100, 50))).every((r) => r.status === 'ready')).toBe(true);
    expect(validationFor(DEFAULT_LABEL)).toEqual({});
    expect(validateRow(raw('x'.repeat(60))).errors).toEqual([ERR.barcodeTooLong]);
  });
});

/** Every label the app offers, both directions, plus two custom sizes. */
const LABELS: LabelSpec[] = [
  ...LABEL_PRESETS.flatMap((p) => [L(p.widthMm, p.lengthMm), L(p.widthMm, p.lengthMm, 'vertical')]),
  L(60, 40),
  L(104, 70, 'vertical'),
];

describe.each(LABELS.map((l) => [`${l.widthMm}×${l.lengthMm} ${l.orientation}`, l] as const))('layout on %s', (_, label) => {
  const g = labelGeometry(label);
  const rows = validateRows(SAMPLE, validationFor(label)).filter((r) => r.tag);

  it('everything stays on the tag; the code has its quiet zones and no text over it', () => {
    for (const r of rows) {
      const { ops, warnings } = layoutTag(r.tag!, metrics, g);
      expect(warnings.filter((w) => /wider|Too much|only/.test(w))).toEqual([]);
      // The code as a box incl. its white border: line barcode (quiet zones left/right) or QR (all round).
      let box: { x0: number; x1: number; y0: number; y1: number };
      if (g.symbology === 'qr') {
        const m = ops.find((o): o is MatrixOp => o.kind === 'matrix')!;
        const quiet = QR_QUIET_MODULES * m.module;
        box = { x0: m.x - quiet, x1: m.x + m.size + quiet, y0: m.y - quiet, y1: m.y + m.size + quiet };
        expect(box.y0).toBeGreaterThanOrEqual(-1e-6);
        expect(box.y1).toBeLessThanOrEqual(g.h + 1e-6);
        expect(m.size).toBeGreaterThanOrEqual(10);
      } else {
        const bars = ops.find((o): o is BarsOp => o.kind === 'bars')!;
        const quiet = QUIET_MODULES * bars.module;
        box = { x0: bars.x - quiet, x1: bars.x + bars.width + quiet, y0: bars.y, y1: bars.y + bars.height };
        expect(bars.y).toBeGreaterThan(0);
        expect(bars.y + bars.height).toBeLessThan(g.h);
        expect(bars.height).toBeGreaterThanOrEqual(8);
      }
      expect(box.x0).toBeGreaterThanOrEqual(-1e-6);
      expect(box.x1).toBeLessThanOrEqual(g.w + 1e-6);

      for (const t of ops.filter((o): o is TextOp => o.kind === 'text')) {
        const top = t.y + t.size * PT_MM * 0.76;
        const bottom = t.y - t.size * PT_MM * 0.24;
        expect(t.x).toBeGreaterThanOrEqual(-1e-6);
        expect(t.x + t.width).toBeLessThanOrEqual(g.w + 1e-6);
        expect(bottom).toBeGreaterThanOrEqual(-1e-6);
        expect(top).toBeLessThanOrEqual(g.h + 1e-6);
        const overlaps = top > box.y0 && bottom < box.y1 && t.x < box.x1 && t.x + t.width > box.x0;
        expect(overlaps, `"${t.text}" overlaps the code`).toBe(false);
      }
    }
  });

  it('the code decodes', () => {
    for (const r of rows) {
      const ops = layoutTag(r.tag!, metrics, g).ops;
      const m = ops.find((o): o is MatrixOp => o.kind === 'matrix');
      const bars = ops.find((o): o is BarsOp => o.kind === 'bars');
      expect(m ? decodeMatrixOp(m) : decodePng(barsToPng(bars!))).toBe(r.tag!.scanIdentifier);
    }
  });
});

describe('content per size', () => {
  it('small tags are the QR tag: store, name, QR, size, MRP (struck), tax, price, Mfd, code, legal footer', () => {
    const tag = validateRow(raw('bt539cfe'), undefined, validationFor(SMALL)).tag!;
    const ops = layoutTag(tag, metrics, labelGeometry(SMALL), NOV_26).ops;
    expect(ops.map((o) => (o.kind === 'text' ? o.text : o.kind))).toEqual([
      'KIDS SURPLUS HUB',
      'line', // rule under the store name
      'Baby Boys Casual T-shirt Shorts',
      'Mfg/Mkt: K.L. Pvt. Ltd. Bengaluru-67  |  Country of Origin: INDIA',
      'bt539cfe',
      'matrix',
      'Size: 0M – 2Y',
      'MRP ₹998.00',
      'line', // strike-through
      '(Incl. of all taxes)',
      '₹282',
      'Mfd: Nov-26',
    ]);
    // No "You save" and no "PRICE" wording on the small tag; Mfd is regular weight; no line barcode; black only.
    const texts = ops.filter((o): o is TextOp => o.kind === 'text');
    expect(texts.some((t) => /You save|PRICE/.test(t.text))).toBe(false);
    expect(texts.find((t) => t.text.startsWith('Mfd'))!.font).toBe('R');
    expect(ops.some((o) => o.kind === 'bars')).toBe(false);
    expect(texts.every((t) => t.gray === 0)).toBe(true);
  });

  it('new SKUs have no size line on the small tag', () => {
    const tag = validateRow(raw(LONG, { color: '', size: '' }), undefined, validationFor(SMALL)).tag!;
    const texts = layoutTag(tag, metrics, labelGeometry(SMALL), NOV_26).ops.filter((o): o is TextOp => o.kind === 'text');
    expect(texts.map((t) => t.text)).toEqual([
      'KIDS SURPLUS HUB',
      'Baby Boys Casual T-shirt Shorts',
      'Mfg/Mkt: K.L. Pvt. Ltd. Bengaluru-67  |  Country of Origin: INDIA',
      LONG,
      'MRP ₹998.00',
      '(Incl. of all taxes)',
      '₹282',
      'Mfd: Nov-26',
    ]);
  });

  it('vertical small tags split the legal footer into two lines', () => {
    const label = L(51, 32, 'vertical');
    const tag = validateRow(raw(LONG, { color: '', size: '' }), undefined, validationFor(label)).tag!;
    const { ops, warnings } = layoutTag(tag, metrics, labelGeometry(label), NOV_26);
    const texts = ops.filter((o): o is TextOp => o.kind === 'text').map((t) => t.text);
    expect(texts).toEqual(expect.arrayContaining(['Mfg/Mkt: K.L. Pvt. Ltd. Bengaluru-67', 'Country of Origin: INDIA']));
    expect(warnings).toEqual([]);
  });

  it('Mfd is the month the tag is made, as Mon-YY', () => {
    expect(mfdText(new Date(2026, 10, 26))).toBe('Mfd: Nov-26');
    expect(mfdText(new Date(2027, 0, 1))).toBe('Mfd: Jan-27');
    expect(mfdText(new Date(2030, 11, 31))).toBe('Mfd: Dec-30');
  });

  it('a very long name is shortened with … on the small tag', () => {
    const tag = validateRow(raw('bt539cfe', { productName: 'W'.repeat(60) }), undefined, validationFor(SMALL)).tag!;
    const { ops, warnings } = layoutTag(tag, metrics, labelGeometry(SMALL));
    expect((ops.filter((o) => o.kind === 'text')[1] as TextOp).text.endsWith('…')).toBe(true);
    expect(warnings).toContain('Product name shortened to fit the small tag');
  });

  it('bigger tags keep the full KSH content, including MRP, price and footer', () => {
    const label = L(100, 50);
    const tag = validateRow(raw('bt539cfe'), undefined, validationFor(label)).tag!;
    const texts = layoutTag(tag, metrics, labelGeometry(label))
      .ops.filter((o): o is TextOp => o.kind === 'text')
      .map((t) => t.text);
    expect(texts).toEqual(
      expect.arrayContaining([
        'KIDS SURPLUS HUB',
        'MAXIMUM RETAIL PRICE',
        '₹998.00',
        'OUR PRICE',
        '₹282',
        'You save ₹716',
        '(Inclusive of all Taxes)',
        'bt539cfe',
        'Customer care: 9972769817  |  care@wishkaro.com',
      ]),
    );
  });

  it('the default label still gives exactly the docs/03 layout', () => {
    const tag = validateRow(raw('bt539cfe')).tag!;
    expect(layoutTag(tag, metrics, labelGeometry(DEFAULT_LABEL))).toEqual(layoutTag(tag, metrics));
  });
});

describe('PDF pages per label', () => {
  const pagesOf = async (label: LabelSpec, mode: 'print' | 'preview') => {
    const rows = validateRows(SAMPLE, validationFor(label));
    const doc = await PDFDocument.load(await renderTagsPdf(expandTags(rows, 1), { mode, fonts, metrics, label }));
    return doc.getPages().map((p) => p.getSize());
  };
  const mm = (pt: number) => Math.round((pt / MM_PT) * 10) / 10;

  it('print pages are the label as printed; preview pages are the tag', async () => {
    const print = await pagesOf(SMALL, 'print');
    expect(print).toHaveLength(20); // every sample code fits as a QR
    expect(new Set(print.map((s) => `${mm(s.width)}x${mm(s.height)}`))).toEqual(new Set(['51x32']));
    const vertical = await pagesOf(L(100, 50, 'vertical'), 'print');
    expect([mm(vertical[0].width), mm(vertical[0].height)]).toEqual([100, 50]);
    const preview = await pagesOf(L(100, 50, 'vertical'), 'preview');
    expect([mm(preview[0].width), mm(preview[0].height)]).toEqual([50, 100]);
  });
});
