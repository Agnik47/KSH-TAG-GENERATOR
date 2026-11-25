/**
 * Barcode round-trip: rasterise the exact bars the PDF draws to a PNG at printer
 * resolution (1 px = 1 dot at 300 dpi), read the PNG back and decode it with ZXing.
 * The decoded text must equal the ScanIdentifier.
 */
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { BarcodeFormat, BinaryBitmap, Code128Reader, DecodeHintType, HybridBinarizer, RGBLuminanceSource } from '@zxing/library';
import { DOT_MM, QUIET_MODULES } from '@/core/tags/barcode/code128';
import { expandTags } from '@/core/tags/csv/expand';
import { validateRow } from '@/core/tags/csv/validate';
import { layoutTag, type BarsOp } from '@/core/tags/layout/tag-layout';
import type { TagData } from '@/core/tags/types';
import { loadSampleRows, metrics } from '../helpers/fixtures';

/** Render the bars op to a PNG buffer: white background, quiet zones, 1 px per printer dot. */
function barsToPng(op: BarsOp): Buffer {
  const quietPx = QUIET_MODULES * op.dots;
  const width = Math.round(op.width / DOT_MM) + 2 * quietPx;
  const height = Math.round(op.height / DOT_MM);
  const png = new PNG({ width, height });
  png.data.fill(255);
  for (const [dx, w] of op.bars) {
    const x0 = quietPx + Math.round(dx / DOT_MM);
    const x1 = x0 + Math.round(w / DOT_MM);
    for (let y = 0; y < height; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = 0;
      }
    }
  }
  return PNG.sync.write(png);
}

function decodePng(buf: Buffer): string {
  const png = PNG.sync.read(buf);
  const lum = new Uint8ClampedArray(png.width * png.height);
  for (let i = 0; i < lum.length; i++) lum[i] = png.data[i * 4];
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, png.width, png.height)));
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]);
  const result = new Code128Reader().decode(bitmap, hints);
  return result.getText();
}

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
