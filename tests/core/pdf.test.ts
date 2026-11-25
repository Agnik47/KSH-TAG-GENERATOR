import { describe, expect, it } from 'vitest';
import fontkit from '@pdf-lib/fontkit';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { expandTags } from '@/core/tags/csv/expand';
import { withCopies } from '@/core/tags/csv/validate';
import { renderTagsPdf } from '@/core/tags/pdf/render-pdf';
import { fonts, loadSampleRows } from '../helpers/fixtures';

const MM = 72 / 25.4;

/** Decoded content stream(s) of a page as text. */
function pageContent(doc: PDFDocument, index: number): string {
  const node = doc.getPage(index).node;
  const contents = node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
  return streams.map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString('latin1')).join('\n');
}

async function load(bytes: Uint8Array) {
  return PDFDocument.load(bytes);
}

describe('PDF rendering', () => {
  const rows = loadSampleRows();

  it('print PDF: 75 × 125 mm pages (212.6 × 354.3 pt), one per tag', async () => {
    const doc = await load(await renderTagsPdf(expandTags(rows, 1), { mode: 'print', fonts }));
    expect(doc.getPageCount()).toBe(20);
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      expect(Math.abs(width - 212.6)).toBeLessThan(0.1);
      expect(Math.abs(height - 354.3)).toBeLessThan(0.1);
      expect(width / MM).toBeCloseTo(75, 6);
      expect(height / MM).toBeCloseTo(125, 6);
    }
  });

  it('preview PDF: 125 × 75 mm pages', async () => {
    const doc = await load(await renderTagsPdf(expandTags(rows, 1), { mode: 'preview', fonts }));
    const { width, height } = doc.getPage(0).getSize();
    expect(width / MM).toBeCloseTo(125, 6);
    expect(height / MM).toBeCloseTo(75, 6);
  });

  it('page count = sum of copies', async () => {
    const edited = rows.map((r, i) => (i === 0 ? withCopies(r, '3') : i === 1 ? withCopies(r, '0') : r));
    const tags = expandTags(edited);
    expect(tags).toHaveLength(3 + 0 + 18);
    const doc = await load(await renderTagsPdf(tags, { mode: 'print', fonts }));
    expect(doc.getPageCount()).toBe(21);
  });

  it('embeds both DejaVu fonts as TrueType font files', async () => {
    const bytes = await renderTagsPdf(expandTags(rows.slice(0, 1), 1), { mode: 'print', fonts });
    const doc = await load(bytes);
    const fontNames: string[] = [];
    let fontFiles = 0;
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFDict) {
        const base = obj.get(PDFName.of('BaseFont'));
        if (base && obj.get(PDFName.of('Type')) === PDFName.of('Font')) fontNames.push(String(base));
        if (obj.get(PDFName.of('FontFile2'))) fontFiles++;
      }
    }
    expect(fontNames.some((n) => n.includes('DejaVuSans-Bold'))).toBe(true);
    expect(fontNames.some((n) => /DejaVuSans(?!-Bold)/.test(n))).toBe(true);
    expect(fontFiles).toBe(2);
  });

  it('the ₹ glyph exists in both fonts', () => {
    for (const bytes of [fonts.regular, fonts.bold]) {
      const f = fontkit.create(bytes);
      expect(f.hasGlyphForCodePoint(0x20b9)).toBe(true);
      expect(f.glyphForCodePoint(0x20b9).id).toBeGreaterThan(0);
    }
  });

  it('print pages use the +90° rotation (translate 75 mm, rotate)', async () => {
    const bytes = await renderTagsPdf(expandTags(rows.slice(0, 1), 1), { mode: 'print', fonts });
    const doc = await load(bytes);
    const text = pageContent(doc, 0);
    // The whole tag is drawn inside q … Q after "0 1 -1 0 <75 mm> 0 cm".
    expect(text).toMatch(/^q\s+0 1 -1 0 212\.59\d* 0 cm/);
    expect(text.trimEnd()).toMatch(/Q$/);
  });

  it('preview pages are not rotated', async () => {
    const doc = await load(await renderTagsPdf(expandTags(rows.slice(0, 1), 1), { mode: 'preview', fonts }));
    expect(pageContent(doc, 0)).not.toMatch(/0 1 -1 0 [\d.]+ 0 cm/);
  });
});
