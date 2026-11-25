import { describe, expect, it } from 'vitest';
import { parseTagCsv } from '@/core/tags/csv/parse';
import {
  ERR,
  buildSkuLine,
  chooseLayout,
  parseCopies,
  parsePrice,
  roundRupees,
  summarise,
  validateRow,
  validateRows,
  withCopies,
} from '@/core/tags/csv/validate';
import { TEMPLATE_CSV, expandTags, expandedCsvFileName, toExpandedCsv } from '@/core/tags/csv/expand';
import { header, loadSampleRows, readSample } from '../helpers/fixtures';
import type { RawRow } from '@/core/tags/types';

const raw = (over: Partial<RawRow> = {}): RawRow => ({
  line: 2,
  scanIdentifier: '15-M-PNT-MKI-26-Q20-HYS-11',
  productName: "Men's Casual Pants",
  color: '',
  size: '',
  mrp: '1190',
  ourPrice: '595',
  copies: '1',
  ...over,
});

describe('parseTagCsv', () => {
  it('reads the canonical headers', () => {
    const r = parseTagCsv(`${header}\nbt539cfe,Baby Shorts,Red,0M – 2Y,998,282.10,3\n`);
    expect(r.fileErrors).toEqual([]);
    expect(r.hasCopiesColumn).toBe(true);
    expect(r.rows).toEqual([
      {
        line: 2,
        scanIdentifier: 'bt539cfe',
        productName: 'Baby Shorts',
        color: 'Red',
        size: '0M – 2Y',
        mrp: '998',
        ourPrice: '282.10',
        copies: '3',
      },
    ]);
  });

  it('accepts aliases, any case, extra columns, trims values', () => {
    const csv = 'ProductCode,barcode,NAME,Colour,size,Brand,mrp,SP,Qty\nX1, bt539cfe ,Shorts,Red,1Y,Wishkaro,998,282,2\n';
    const r = parseTagCsv(csv);
    expect(r.fileErrors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      scanIdentifier: 'bt539cfe',
      productName: 'Shorts',
      color: 'Red',
      size: '1Y',
      mrp: '998',
      ourPrice: '282',
      copies: '2',
    });
  });

  it.each([
    ['SKU', 'Title', 'SellingPrice', 'Quantity'],
    ['Code', 'Name', 'Price', 'Copies'],
  ])('alias set %s/%s/%s/%s', (code, name, price, qty) => {
    const r = parseTagCsv(`${code},${name},MRP,${price},${qty}\nabc,Thing,100,50,4\n`);
    expect(r.fileErrors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ scanIdentifier: 'abc', productName: 'Thing', mrp: '100', ourPrice: '50', copies: '4' });
  });

  it('prefers the canonical column when an alias is also present', () => {
    const r = parseTagCsv('SKU,ScanIdentifier,ProductName,MRP,OurPrice\nbt539cfe_1-2_Years,bt539cfe,Shorts,998,282\n');
    expect(r.rows[0].scanIdentifier).toBe('bt539cfe');
  });

  it('strips a UTF-8 BOM and handles CRLF + blank lines', () => {
    const r = parseTagCsv(`﻿${header}\r\nabc,Thing,,,100,50,1\r\n\r\n,,,,,,\r\n`);
    expect(r.fileErrors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].scanIdentifier).toBe('abc');
  });

  it('handles quoted fields with commas', () => {
    const r = parseTagCsv(`${header}\nabc,"Shirt, Blue",,,100,50,1\n`);
    expect(r.rows[0].productName).toBe('Shirt, Blue');
  });

  it('reports missing required columns', () => {
    const r = parseTagCsv('ScanIdentifier,Copies\nabc,1\n');
    expect(r.fileErrors).toEqual(['Missing column: ProductName', 'Missing column: MRP', 'Missing column: OurPrice']);
  });

  it('empty file', () => {
    expect(parseTagCsv('').fileErrors).toEqual(['The file is empty.']);
  });

  it('one-row-per-label file (no Copies column): each row = 1 tag, duplicates kept', () => {
    const r = parseTagCsv(readSample('ksh_tags_sample_expanded_output.csv'));
    expect(r.hasCopiesColumn).toBe(false);
    const rows = validateRows(r.rows);
    expect(rows.map((x) => x.status)).toEqual(['ready', 'ready', 'ready', 'ready']);
    expect(rows.every((x) => x.copies === 1)).toBe(true);
    expect(expandTags(rows)).toHaveLength(4);
  });
});

describe('Copies', () => {
  it('empty = 1, 0 = skip, whole numbers 0–999 only', () => {
    expect(parseCopies(null)).toBe(1);
    expect(parseCopies('')).toBe(1);
    expect(parseCopies('  ')).toBe(1);
    expect(parseCopies('0')).toBe(0);
    expect(parseCopies('20')).toBe(20);
    expect(parseCopies('999')).toBe(999);
    expect(parseCopies('2.0')).toBe(2);
    expect(parseCopies('1000')).toBeNull();
    expect(parseCopies('-1')).toBeNull();
    expect(parseCopies('1.5')).toBeNull();
    expect(parseCopies('two')).toBeNull();
  });

  it('row with Copies 0 is skipped and not printed; empty prints 1', () => {
    const rows = validateRows([raw({ copies: '0' }), raw({ copies: '' }), raw({ copies: '3' })]);
    expect(rows.map((r) => r.status)).toEqual(['skipped', 'ready', 'ready']);
    expect(expandTags(rows)).toHaveLength(4);
    expect(summarise(rows)).toEqual({ total: 3, ready: 2, errors: 0, skipped: 1, labels: 4 });
  });

  it('editing Copies re-validates the row', () => {
    const row = validateRow(raw({ copies: '1' }));
    expect(withCopies(row, '5')).toMatchObject({ id: row.id, status: 'ready', copies: 5 });
    expect(withCopies(row, '0').status).toBe('skipped');
    expect(withCopies(row, 'abc')).toMatchObject({ status: 'error', errors: [ERR.badCopies] });
  });
});

describe('validation errors', () => {
  const errs = (over: Partial<RawRow>) => validateRow(raw(over)).errors;

  it('valid row has no errors', () => expect(errs({})).toEqual([]));
  it('missing barcode', () => expect(errs({ scanIdentifier: '' })).toEqual([ERR.missingBarcode]));
  it('invalid characters', () => expect(errs({ scanIdentifier: 'bt539–cfe' })).toEqual([ERR.invalidBarcode]));
  it('too long', () => expect(errs({ scanIdentifier: 'A'.repeat(40) })).toEqual([ERR.barcodeTooLong]));
  it('missing name', () => expect(errs({ productName: '' })).toEqual([ERR.missingName]));
  it('bad MRP', () => {
    expect(errs({ mrp: '' })).toEqual([ERR.badMrp]);
    expect(errs({ mrp: '0' })).toEqual([ERR.badMrp]);
    expect(errs({ mrp: 'abc' })).toEqual([ERR.badMrp]);
    expect(errs({ mrp: '-5' })).toEqual([ERR.badMrp]);
  });
  it('bad price', () => {
    expect(errs({ ourPrice: '' })).toEqual([ERR.badPrice]);
    expect(errs({ ourPrice: '0' })).toEqual([ERR.badPrice]);
  });
  it('price above MRP', () => expect(errs({ ourPrice: '1190.01' })).toEqual([ERR.priceAboveMrp]));
  it('price equal to MRP is fine', () => expect(errs({ ourPrice: '1190' })).toEqual([]));
  it('bad copies', () => expect(errs({ copies: '1000' })).toEqual([ERR.badCopies]));
  it('collects several errors; error rows are never printed', () => {
    const r = validateRow(raw({ scanIdentifier: '', productName: '', mrp: 'x' }));
    expect(r.status).toBe('error');
    expect(r.errors).toEqual([ERR.missingBarcode, ERR.missingName, ERR.badMrp]);
    expect(expandTags([r])).toEqual([]);
  });
});

describe('prices and derived values', () => {
  it('parsePrice accepts ₹, Rs and thousands separators', () => {
    expect(parsePrice('1190')).toBe(1190);
    expect(parsePrice('₹1,190.00')).toBe(1190);
    expect(parsePrice('Rs. 998')).toBe(998);
    expect(parsePrice('282.10')).toBe(282.1);
    expect(parsePrice('1e3')).toBeNull();
  });

  it('rounds OurPrice half up to whole rupees', () => {
    expect(roundRupees(282.1)).toBe(282);
    expect(roundRupees(282.49)).toBe(282);
    expect(roundRupees(282.5)).toBe(283);
    expect(roundRupees(0.5)).toBe(1);
  });

  it('You save = MRP − round(OurPrice)', () => {
    expect(validateRow(raw({ mrp: '998', ourPrice: '282.10', color: 'Red' })).tag).toMatchObject({ ourPrice: 282, youSave: 716 });
    expect(validateRow(raw()).tag).toMatchObject({ ourPrice: 595, youSave: 595 });
    expect(validateRow(raw({ mrp: '1749', ourPrice: '259' })).tag!.youSave).toBe(1490);
  });

  it('You save is never negative when rounding pushes price over a decimal MRP', () => {
    expect(validateRow(raw({ mrp: '99.5', ourPrice: '99.5' })).tag).toMatchObject({ ourPrice: 100, youSave: 0 });
  });
});

describe('layout choice and SKU line', () => {
  it('old if Color or Size filled, new if both empty', () => {
    expect(chooseLayout('Red', '0M – 2Y')).toBe('old');
    expect(chooseLayout('Red', '')).toBe('old');
    expect(chooseLayout('', '1Y')).toBe('old');
    expect(chooseLayout('', '')).toBe('new');
    expect(chooseLayout(' ', ' ')).toBe('new');
  });

  it('builds the SKU line', () => {
    expect(buildSkuLine('15-M-PNT-MKI-26-Q20-HYS-11', 'new', '', '')).toBe('SKU : 15-M-PNT-MKI-26-Q20-HYS-11');
    expect(buildSkuLine('bt539cfe', 'old', 'Red', '0M – 2Y')).toBe('SKU : bt539cfe  |  Color : Red  |  Size : 0M – 2Y');
  });
});

describe('sample files', () => {
  it('sample input → 20 Ready rows (18 new + 2 old), 20 labels', () => {
    const rows = loadSampleRows();
    expect(rows).toHaveLength(20);
    expect(rows.every((r) => r.status === 'ready')).toBe(true);
    expect(rows.filter((r) => r.tag!.layout === 'new')).toHaveLength(18);
    expect(rows.filter((r) => r.tag!.layout === 'old').map((r) => r.tag!.scanIdentifier)).toEqual(['bt539cfe', 'bt624y']);
    expect(summarise(rows).labels).toBe(20);
  });

  it('expanded CSV matches samples/ksh_tags_sample_expanded_output.csv byte for byte', () => {
    const input = `${header}\n15-M-PNT-MKI-26-Q20-HYS-11,Men's Casual Pants,,,1190,595,2\nbt539cfe,Baby Boys Casual T-shirt Shorts,Red,0M – 2Y,998,282.10,2\n`;
    const rows = validateRows(parseTagCsv(input).rows);
    expect(toExpandedCsv(expandTags(rows))).toBe(readSample('ksh_tags_sample_expanded_output.csv'));
  });

  it('expanded CSV quotes fields that need it', () => {
    const rows = validateRows([raw({ productName: 'Shirt, "Blue"', copies: '1' })]);
    expect(toExpandedCsv(expandTags(rows)).split('\r\n')[1]).toContain('"Shirt, ""Blue"""');
  });

  it('template matches samples/ksh_tags_template.csv', () => {
    expect(TEMPLATE_CSV).toBe(readSample('ksh_tags_template.csv'));
  });

  it('expanded CSV file name', () => {
    expect(expandedCsvFileName(new Date(2026, 10, 25, 9, 5), 40)).toBe('ksh-tags_2026-11-25_0905_40.csv');
  });

  it('test print = 1 per ready row regardless of Copies', () => {
    const rows = validateRows([raw({ copies: '5' }), raw({ copies: '0' }), raw({ copies: '2' })]);
    expect(expandTags(rows, 1)).toHaveLength(2);
  });
});
