/** Rasterise a barcode exactly as the PDF draws it (1 px = 1 printer dot) and decode it with ZXing. */
import { PNG } from 'pngjs';
import {
  BarcodeFormat,
  BinaryBitmap,
  Code128Reader,
  DecodeHintType,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from '@zxing/library';
import { DOT_MM, QUIET_MODULES } from '@/core/tags/barcode/code128';
import type { BarsOp, MatrixOp } from '@/core/tags/layout/tag-layout';

/** Render the bars op to a PNG buffer: white background, quiet zones, 1 px per printer dot. */
export function barsToPng(op: BarsOp): Buffer {
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

export function decodePng(buf: Buffer): string {
  const png = PNG.sync.read(buf);
  const lum = new Uint8ClampedArray(png.width * png.height);
  for (let i = 0; i < lum.length; i++) lum[i] = png.data[i * 4];
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, png.width, png.height)));
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]);
  const result = new Code128Reader().decode(bitmap, hints);
  return result.getText();
}

/** Render a QR op to a PNG (1 px = 1 printer dot) with its 4-square quiet zone, and decode it. */
export function decodeMatrixOp(op: MatrixOp): string {
  const px = op.dots;
  const quiet = 4 * px;
  const size = op.n * px + 2 * quiet;
  const png = new PNG({ width: size, height: size });
  png.data.fill(255);
  for (const [row, col, len] of op.runs) {
    for (let y = quiet + row * px; y < quiet + (row + 1) * px; y++) {
      for (let x = quiet + col * px; x < quiet + (col + len) * px; x++) {
        const i = (y * size + x) * 4;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = 0;
      }
    }
  }
  const lum = new Uint8ClampedArray(size * size);
  for (let i = 0; i < lum.length; i++) lum[i] = png.data[i * 4];
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, size, size)));
  return new QRCodeReader().decode(bitmap, new Map([[DecodeHintType.PURE_BARCODE, true]])).getText();
}
