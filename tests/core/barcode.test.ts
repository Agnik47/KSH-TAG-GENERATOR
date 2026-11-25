import { describe, expect, it } from 'vitest';
import {
  DOT_MM,
  barcodeWidthMm,
  chooseModuleDots,
  encodeCode128,
  isPrintableAscii,
  planBarcode,
} from '@/core/tags/barcode/code128';

describe('Code 128 module choice (docs/03)', () => {
  it('bt539cfe → 7 dots', () => {
    const { enc, dots } = planBarcode('bt539cfe');
    expect(dots).toBe(7);
    expect(enc.modules).toBe(123); // start + 8 data + check = 10 × 11 + stop 13
  });

  it('1-MS-VC-26-Q56-WOS-11 → 4 dots, ≈ 90 mm', () => {
    const { enc, dots } = planBarcode('1-MS-VC-26-Q56-WOS-11');
    expect(dots).toBe(4);
    expect(barcodeWidthMm(enc.modules, 4)).toBeCloseTo(90.1, 0);
  });

  it('15-M-PNT-MKI-26-Q20-HYS-11 → 3 dots, ≈ 82 mm', () => {
    const { enc, dots } = planBarcode('15-M-PNT-MKI-26-Q20-HYS-11');
    expect(dots).toBe(3);
    expect(barcodeWidthMm(enc.modules, 3)).toBeCloseTo(81.5, 0);
  });

  it('always fits 113 mm including 10-module quiet zones', () => {
    for (const code of ['bt539cfe', 'bt624y', '1-MS-VC-26-Q56-WOS-11', '18-SHRTG-MKI-26-Q125-EH-11']) {
      const { enc, dots } = planBarcode(code);
      expect(dots).not.toBeNull();
      expect((enc.modules + 20) * dots! * DOT_MM).toBeLessThanOrEqual(113);
    }
  });

  it('too long → null', () => {
    expect(planBarcode('X'.repeat(40)).dots).toBeNull();
    expect(chooseModuleDots(10_000)).toBeNull();
  });

  it('picks the widest that fits', () => {
    // 123 modules: 7 dots = (143) × 0.5927 = 84.8 mm → fits.
    expect(chooseModuleDots(123)).toBe(7);
    // 266 modules: 5 dots = 286 × 0.4233 = 121 mm (no), 4 dots = 96.9 mm (yes).
    expect(chooseModuleDots(266)).toBe(4);
  });

  it('bars start with a bar and widths sum to the module count', () => {
    const enc = encodeCode128('bt539cfe');
    expect(enc.sbs.length % 2).toBe(1); // bar, space, …, bar
    expect(enc.sbs.reduce((a, b) => a + b, 0)).toBe(enc.modules);
  });

  it('printable ASCII check', () => {
    expect(isPrintableAscii('15-M-PNT-MKI-26-Q20-HYS-11')).toBe(true);
    expect(isPrintableAscii('abc def')).toBe(true);
    expect(isPrintableAscii('bt539–cfe')).toBe(false);
    expect(isPrintableAscii('a\tb')).toBe(false);
    expect(isPrintableAscii('')).toBe(false);
  });
});
