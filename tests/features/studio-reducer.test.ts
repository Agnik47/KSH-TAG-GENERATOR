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

  it('select ignores unknown ids; clear resets everything', () => {
    const s = run(sample());
    expect(studioReducer(s, { type: 'select', id: 'nope' })).toBe(s);
    expect(studioReducer(s, { type: 'clear' })).toEqual(initialStudioState);
  });
});
