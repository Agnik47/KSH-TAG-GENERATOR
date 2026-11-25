import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { expandTags } from '@/core/tags/csv/expand';
import { validateRow } from '@/core/tags/csv/validate';
import { layoutTag } from '@/core/tags/layout/tag-layout';
import { renderTagsPdf } from '@/core/tags/pdf/render-pdf';
import { checkTagFile, decodeCsvBytes, readTagFile } from '@/lib/browser/read-tag-file';
import { buildTagsWorkbook } from '@/core/tags/xlsx';
import { fonts, loadSampleRows, metrics } from '../helpers/fixtures';

describe('characters the font cannot print', () => {
  it('finds them', () => {
    expect(metrics.unsupportedChars("Men's Pants – ₹ “ok”", 'R')).toEqual([]);
    expect(metrics.unsupportedChars('Kurta कुर्ता', 'R')).toEqual(expect.arrayContaining(['क', 'र']));
  });

  it('adds a warning to the tag layout', () => {
    const tag = validateRow({
      line: 2,
      scanIdentifier: 'X1',
      productName: 'Shirt क',
      color: '',
      size: '',
      mrp: '10',
      ourPrice: '5',
      copies: '1',
    }).tag!;
    expect(layoutTag(tag, metrics).warnings.join()).toContain('cannot be printed: क');
  });
});

describe('reading files (CSV and Excel)', () => {
  it('recognises CSV and .xlsx; refuses other spreadsheets, empty and huge files', () => {
    expect(checkTagFile('tags.csv', 'text/csv', 100)).toEqual({ kind: 'csv' });
    expect(checkTagFile('tags.csv', 'application/vnd.ms-excel', 100)).toEqual({ kind: 'csv' });
    expect(checkTagFile('tags.xlsx', '', 100)).toEqual({ kind: 'xlsx' });
    expect(checkTagFile('TAGS.XLSX', '', 100)).toEqual({ kind: 'xlsx' });
    expect(checkTagFile('old.xls', '', 100)).toMatchObject({ error: expect.stringMatching(/\.xlsx/) });
    expect(checkTagFile('tags.ods', '', 100)).toMatchObject({ error: expect.stringMatching(/cannot be read/) });
    expect(checkTagFile('tags.pdf', 'application/pdf', 10)).toEqual({ error: 'Please choose an Excel (.xlsx) or CSV file.' });
    expect(checkTagFile('tags.csv', 'text/csv', 0)).toEqual({ error: 'The file is empty.' });
    expect(checkTagFile('tags.csv', 'text/csv', 50 * 1024 * 1024)).toMatchObject({ error: expect.stringMatching(/too big/) });
  });

  it('reads UTF-8 as is', () => {
    expect(decodeCsvBytes(new TextEncoder().encode('Size\n0M – 2Y\n'))).toEqual({ text: 'Size\n0M – 2Y\n' });
  });

  it('falls back to Windows-1252 (Excel "CSV (Comma delimited)") with a notice', () => {
    // "0M – 2Y" where the en dash is byte 0x96 in Windows-1252.
    const r = decodeCsvBytes(new Uint8Array([0x30, 0x4d, 0x20, 0x96, 0x20, 0x32, 0x59]));
    expect(r.text).toBe('0M – 2Y');
    expect(r.notice).toBeTruthy();
  });

  it('readTagFile turns an .xlsx into a table and a CSV into text', async () => {
    const xlsx = new File(
      [await buildTagsWorkbook([{ scanIdentifier: 'A1', productName: 'One', mrp: 100, ourPrice: 50, copies: 2 }])],
      'tags.xlsx',
    );
    const r1 = await readTagFile(xlsx);
    expect(r1.ok && r1.content.kind).toBe('table');
    if (r1.ok && r1.content.kind === 'table') expect(r1.content.rows[3].slice(0, 2)).toEqual(['A1', 'One']);

    const r2 = await readTagFile(
      new File(['ScanIdentifier,ProductName,MRP,OurPrice\nA1,One,100,50\n'], 'tags.csv', { type: 'text/csv' }),
    );
    expect(r2).toMatchObject({ ok: true, content: { kind: 'csv' } });
  });

  it('a broken .xlsx gives a clear error', async () => {
    const r = await readTagFile(new File(['not really excel'], 'broken.xlsx'));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/could not be read/) });
  });
});

describe('PDF size and reuse', () => {
  it('copies of the same tag reuse one drawing (file barely grows with copies)', async () => {
    const rows = loadSampleRows();
    const one = await renderTagsPdf(expandTags(rows, 1), { mode: 'print', fonts, metrics });
    const ten = await renderTagsPdf(
      expandTags(rows, 1).flatMap((t) => Array(10).fill(t)),
      { mode: 'print', fonts, metrics },
    );
    expect((await PDFDocument.load(ten)).getPageCount()).toBe(200);
    // 180 extra pages should add only a few hundred bytes each, not a full tag drawing each.
    expect(ten.length - one.length).toBeLessThan(180 * 400);
  });
});
