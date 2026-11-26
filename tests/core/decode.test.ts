/**
 * Barcode round-trip: rasterise the exact bars the PDF draws to a PNG at printer
 * resolution (1 px = 1 dot at 300 dpi), read the PNG back and decode it with ZXing.
 * The decoded text must equal the ScanIdentifier.
 */
import { describe, expect, it } from 'vitest';
import { DOT_MM } from '@/core/tags/barcode/code128';
import { expandTags } from '@/core/tags/csv/expand';
import { validateRow } from '@/core/tags/csv/validate';
import { layoutTag, type BarsOp } from '@/core/tags/layout/tag-layout';
import type { TagData } from '@/core/tags/types';
import { barsToPng, decodePng } from '../helpers/barcode-raster';
import { loadSampleRows, metrics } from '../helpers/fixtures';

function barsOf(tag: TagData): BarsOp {
  return layoutTag(tag, metrics).ops.find((o): o is BarsOp => o.kind === 'bars')!;
}

describe('rendered barcode decodes back to the ScanIdentifier', () => {
  const tags = expandTags(loadSampleRows(), 1);

  it.each(tags.map((t) => [t.scanIdentifier, t] as const))('%s', (code, tag) => {
    const op = barsOf(tag);
    // Every bar is a whole number of printer dots.
    for (const [dx, w] of op.bars) {
      expect(Math.abs(dx / DOT_MM - Math.round(dx / DOT_MM))).toBeLessThan(1e-6);
      expect(Math.abs(w / DOT_MM - Math.round(w / DOT_MM))).toBeLessThan(1e-6);
    }
    expect(decodePng(barsToPng(op))).toBe(code);
  });

  it.each(['abc def', 'A-1/2+3%', '1234567890', 'MiXeD_case.09'])('other printable values: %s', (code) => {
    const tag = validateRow({
      line: 2,
      scanIdentifier: code,
      productName: 'X',
      color: '',
      size: '',
      mrp: '10',
      ourPrice: '5',
      copies: '1',
    }).tag!;
    expect(decodePng(barsToPng(barsOf(tag)))).toBe(code);
  });
});
