import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFontMetrics, type FontBytes } from '@/core/tags/layout/font-metrics';
import { parseTagCsv } from '@/core/tags/csv/parse';
import { validateRows } from '@/core/tags/csv/validate';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export function loadFonts(): FontBytes {
  return {
    regular: new Uint8Array(readFileSync(join(ROOT, 'public/fonts/DejaVuSans.ttf'))),
    bold: new Uint8Array(readFileSync(join(ROOT, 'public/fonts/DejaVuSans-Bold.ttf'))),
  };
}

export const fonts = loadFonts();
export const metrics = createFontMetrics(fonts);
export const measure = metrics.measure;

export function readSample(name: string): string {
  return readFileSync(join(ROOT, 'samples', name), 'utf8');
}

export function loadSampleRows() {
  return validateRows(parseTagCsv(readSample('ksh_tags_sample_input.csv')).rows);
}

export const header = 'ScanIdentifier,ProductName,Color,Size,MRP,OurPrice,Copies';
