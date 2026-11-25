import { describe, expect, it } from 'vitest';
import { MAX_COPIES, parseCopies, sanitizeCopiesInput, validateRow, withCopies } from '@/core/tags/csv/validate';
import type { RawRow } from '@/core/tags/types';

const raw = (copies: string | null): RawRow => ({
  line: 2,
  scanIdentifier: 'bt539cfe',
  productName: 'Shorts',
  color: 'Red',
  size: '1Y',
  mrp: '998',
  ourPrice: '282',
  copies,
});

describe('sanitizeCopiesInput (what staff type in the Copies box)', () => {
  it.each([
    ['011', '11'],
    ['021', '21'],
    ['0111', '111'],
    ['01', '1'],
    ['000', '0'],
    ['0', '0'],
    ['', ''],
    ['12', '12'],
    ['9999', '999'],
    ['1234', '123'],
    [' 5 ', '5'],
    ['-3', '3'],
    ['2.5', '25'],
    ['abc', ''],
  ])('%j → %j', (input, expected) => {
    expect(sanitizeCopiesInput(input)).toBe(expected);
  });

  it('never produces leading zeros or more than 999', () => {
    for (let i = 0; i < 2000; i++) {
      const s = sanitizeCopiesInput(String(i).padStart(4, '0'));
      expect(s === '0' || !s.startsWith('0')).toBe(true);
      expect(Number(s)).toBeLessThanOrEqual(MAX_COPIES);
    }
  });
});

describe('Copies in files', () => {
  it('tolerates leading zeros in a CSV and shows the clean number', () => {
    expect(parseCopies('011')).toBe(11);
    const row = validateRow(raw('011'));
    expect(row).toMatchObject({ status: 'ready', copies: 11, copiesText: '11' });
  });

  it('empty or missing Copies shows 1', () => {
    expect(validateRow(raw('')).copiesText).toBe('1');
    expect(validateRow(raw(null)).copiesText).toBe('1');
  });

  it('bad Copies keeps the raw text so the person can see and fix it', () => {
    expect(validateRow(raw('1000'))).toMatchObject({ status: 'error', copiesText: '1000' });
    expect(validateRow(raw('-1'))).toMatchObject({ status: 'error', copiesText: '-1' });
  });

  it('fixing a bad Copies in the table makes the row ready again', () => {
    const bad = validateRow(raw('abc'));
    expect(bad.status).toBe('error');
    expect(withCopies(bad, '4')).toMatchObject({ id: bad.id, status: 'ready', copies: 4 });
  });
});
