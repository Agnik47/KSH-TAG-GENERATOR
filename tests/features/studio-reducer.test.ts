import { describe, expect, it } from 'vitest';
import {
  initialStudioState,
  selectedRow,
  studioReducer,
  visibleRows,
  type StudioAction,
  type StudioState,
} from '@/features/tag-studio/state/studio-reducer';
import { header, readSample } from '../helpers/fixtures';

const run = (...actions: StudioAction[]): StudioState => actions.reduce(studioReducer, initialStudioState);
const sample = (): StudioAction => ({
  type: 'loaded',
  name: 'sample.csv',
  content: { kind: 'csv', text: readSample('ksh_tags_sample_input.csv') },
  isSample: true,
});

const MIXED = [header, 'A1,Good one,,,100,50,2', ',No code,,,100,50,1', 'A3,Skipped,,,100,50,0', 'A4,Good two,,,200,150,1'].join(
  '\n',
);

describe('studioReducer', () => {
  it('loads a file and selects the first ready row', () => {
    const s = run(sample());
    expect(s.rows).toHaveLength(20);
    expect(s.source).toEqual({ name: 'sample.csv', isSample: true });
    expect(s.selectedId).toBe(s.rows[0].id);
    expect(s.fileErrors).toEqual([]);
  });

  it('a file with missing columns shows file errors and no rows', () => {
    const s = run({ type: 'loaded', name: 'bad.csv', content: { kind: 'csv', text: 'Foo,Bar\n1,2\n' } });
    expect(s.rows).toEqual([]);
    expect(s.fileErrors).toContain('Missing column: ScanIdentifier');
  });

  it('a file with only headers is an error', () => {
    const s = run({ type: 'loaded', name: 'empty.csv', content: { kind: 'csv', text: `${header}\n` } });
    expect(s.fileErrors).toEqual(['No product rows found. Fill at least one row under the header row.']);
  });

  it('loads an Excel table (title rows above the header are fine)', () => {
    const s = run({
      type: 'loaded',
      name: 'tags.xlsx',
      content: {
        kind: 'table',
        rows: [
          ['KSH Tag Studio · Price tag list'],
          ['legend'],
          ['ScanIdentifier', 'ProductName', 'MRP', 'OurPrice', 'Copies'],
          ['A1', 'One', '100', '50', '011'],
        ],
      },
    });
    expect(s.fileErrors).toEqual([]);
    expect(s.rows[0]).toMatchObject({ status: 'ready', copies: 11, raw: { line: 4 } });
  });

  it('loadFailed keeps the reason', () => {
    expect(run({ type: 'loadFailed', name: 'x.xlsx', error: 'Not a CSV' }).fileErrors).toEqual(['Not a CSV']);
  });

  it('setCopies cleans the typed value ("011" → 11)', () => {
    const s0 = run(sample());
    const id = s0.rows[2].id;
    const s1 = studioReducer(s0, { type: 'setCopies', id, value: '011' });
    const row = s1.rows[2];
    expect(row).toMatchObject({ id, copies: 11, copiesText: '11', status: 'ready' });
    expect(s1.rows[0]).toBe(s0.rows[0]); // other rows untouched
  });

  it('setCopies "0" skips the row; "" means 1', () => {
    const s0 = run(sample());
    const id = s0.rows[0].id;
    expect(studioReducer(s0, { type: 'setCopies', id, value: '0' }).rows[0].status).toBe('skipped');
    expect(studioReducer(s0, { type: 'setCopies', id, value: '' }).rows[0]).toMatchObject({ copies: 1, copiesText: '1' });
  });

  it('setAllCopies applies to every row; empty is ignored', () => {
    const s0 = run(sample());
    const s1 = studioReducer(s0, { type: 'setAllCopies', value: '03' });
    expect(s1.rows.every((r) => r.copies === 3)).toBe(true);
    expect(studioReducer(s0, { type: 'setAllCopies', value: '' })).toBe(s0);
  });

  it('filters rows by status and keeps "#" independent of the filter', () => {
    const s = run({ type: 'loaded', name: 'm.csv', content: { kind: 'csv', text: MIXED } });
    expect(visibleRows(s)).toHaveLength(4);
    const errors = studioReducer(s, { type: 'setFilter', filter: 'error' });
    expect(visibleRows(errors).map((r) => r.raw.productName)).toEqual(['No code']);
    // Selection moves into the filtered list.
    expect(selectedRow(errors)?.raw.productName).toBe('No code');
    expect(visibleRows(studioReducer(s, { type: 'setFilter', filter: 'skipped' }))).toHaveLength(1);
    expect(visibleRows(studioReducer(s, { type: 'setFilter', filter: 'ready' }))).toHaveLength(2);
  });

  it('selectRelative moves within the visible rows and stops at the ends', () => {
    let s = run({ type: 'loaded', name: 'm.csv', content: { kind: 'csv', text: MIXED } });
    expect(selectedRow(s)?.raw.productName).toBe('Good one');
    s = studioReducer(s, { type: 'selectRelative', delta: -1 });
    expect(selectedRow(s)?.raw.productName).toBe('Good one');
    s = studioReducer(s, { type: 'selectRelative', delta: 1 });
    expect(selectedRow(s)?.raw.productName).toBe('No code');
    s = studioReducer(s, { type: 'selectRelative', delta: 10 });
    expect(selectedRow(s)?.raw.productName).toBe('Good two');
  });

  it('setLabel re-checks every row for the new size, keeping ids and copies', () => {
    const base = run(sample());
    const s0 = studioReducer(base, { type: 'setCopies', id: base.rows[18].id, value: '4' });
    // A narrow line-barcode tag: only the two short Wishkaro codes fit; the 18 long SKU codes become errors.
    const small = studioReducer(s0, { type: 'setLabel', label: { widthMm: 75, lengthMm: 125, orientation: 'vertical' } });
    expect(small.rows.filter((r) => r.status === 'ready').map((r) => r.raw.scanIdentifier)).toEqual(['bt539cfe', 'bt624y']);
    expect(small.rows[0].errors[0]).toContain('too long for 75 × 125 mm vertical');
    expect(small.rows.map((r) => r.id)).toEqual(s0.rows.map((r) => r.id));
    expect(small.rows[18].copies).toBe(4);
    // Back to the standard roll: everything is ready again.
    const back = studioReducer(small, { type: 'setLabel', label: initialStudioState.label });
    expect(back.rows.every((r) => r.status === 'ready')).toBe(true);
    // Same label again changes nothing.
    expect(studioReducer(small, { type: 'setLabel', label: { ...small.label } })).toBe(small);
  });

  it('the label is kept when a file is loaded or the list is cleared', () => {
    const label = { widthMm: 75, lengthMm: 125, orientation: 'vertical' } as const;
    const s = studioReducer(run(), { type: 'setLabel', label });
    const loaded = studioReducer(s, sample());
    expect(loaded.label).toEqual(label);
    expect(loaded.rows.filter((r) => r.status === 'ready')).toHaveLength(2);
    expect(studioReducer(loaded, { type: 'clear' }).label).toEqual(label);
    // Copies edits are checked against the chosen label too.
    const longId = loaded.rows[0].id;
    expect(studioReducer(loaded, { type: 'setCopies', id: longId, value: '2' }).rows[0].status).toBe('error');
  });

  it('the 51 × 32 QR tag accepts every sample code (new and old SKUs)', () => {
    const s = studioReducer(run(sample()), { type: 'setLabel', label: { widthMm: 51, lengthMm: 32, orientation: 'horizontal' } });
    expect(s.rows.every((r) => r.status === 'ready')).toBe(true);
  });

  it('select ignores unknown ids; clear resets everything', () => {
    const s = run(sample());
    expect(studioReducer(s, { type: 'select', id: 'nope' })).toBe(s);
    expect(studioReducer(s, { type: 'clear' })).toEqual(initialStudioState);
  });
});
