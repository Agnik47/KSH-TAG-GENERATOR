import fontkit from '@pdf-lib/fontkit';
import type { FontId } from './tag-layout';

/** The two TTF files every renderer needs (DejaVu Sans + DejaVu Sans Bold). */
export interface FontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
}

/** Width of `text` in points at `sizePt`, using the DejaVu advance widths. */
export type Measure = (text: string, font: FontId, sizePt: number) => number;

export interface FontMetrics {
  measure: Measure;
  /** Characters in `text` that the font cannot draw (they would print as an empty box). */
  unsupportedChars: (text: string, font: FontId) => string[];
}

/**
 * Text metrics based on the fonts' glyph advance widths — the same way pdf-lib lays out the
 * text it draws (and the same widths ReportLab used in the reference scripts). No kerning.
 * Works in Node and in the browser.
 */
export function createFontMetrics(fonts: FontBytes): FontMetrics {
  const faces = {
    R: fontkit.create(fonts.regular),
    B: fontkit.create(fonts.bold),
  } as const;
  const widthCache = new Map<string, number>();

  const measure: Measure = (text, font, sizePt) => {
    const key = `${font}|${text}`;
    let units = widthCache.get(key);
    if (units === undefined) {
      const face = faces[font];
      const run = face.layout(text);
      units = run.glyphs.reduce((sum, g) => sum + g.advanceWidth, 0) / face.unitsPerEm;
      widthCache.set(key, units);
    }
    return units * sizePt;
  };

  const unsupportedChars = (text: string, font: FontId): string[] => {
    const face = faces[font];
    const missing = new Set<string>();
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp >= 0x20 && !face.hasGlyphForCodePoint(cp)) missing.add(ch);
    }
    return [...missing];
  };

  return { measure, unsupportedChars };
}
