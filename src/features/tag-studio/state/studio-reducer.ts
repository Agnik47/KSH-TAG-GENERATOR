/**
 * Tag Studio state as a pure reducer (no React, no DOM) so every transition is unit-tested.
 */
import {
  DEFAULT_LABEL,
  parseTagCsv,
  parseTagTable,
  revalidate,
  sameLabel,
  sanitizeCopiesInput,
  validateRows,
  validationFor,
  withCopies,
  type LabelSpec,
  type RowStatus,
  type ValidatedRow,
} from '@/core/tags';

export type RowFilter = 'all' | RowStatus;

export interface StudioSource {
  name: string;
  isSample: boolean;
}

export interface StudioState {
  source: StudioSource | null;
  rows: ValidatedRow[];
  /** Problems with the file as a whole; when set, no rows are shown. */
  fileErrors: string[];
  /** Non-blocking note about the file (e.g. it was not UTF-8). */
  notice: string | null;
  selectedId: string | null;
  filter: RowFilter;
  /** Label size + orientation. Kept when another file is loaded or the list is cleared. */
  label: LabelSpec;
}

export type StudioAction =
  | {
      type: 'loaded';
      name: string;
      /** CSV text, or the cell table of an Excel sheet. */
      content: { kind: 'csv'; text: string } | { kind: 'table'; rows: string[][] };
      isSample?: boolean;
      notice?: string;
    }
  | { type: 'loadFailed'; name: string; error: string }
  | { type: 'setCopies'; id: string; value: string }
  | { type: 'setAllCopies'; value: string }
  | { type: 'select'; id: string }
  | { type: 'selectRelative'; delta: number }
  | { type: 'setFilter'; filter: RowFilter }
  | { type: 'setLabel'; label: LabelSpec }
  | { type: 'clear' };

export const initialStudioState: StudioState = {
  source: null,
  rows: [],
  fileErrors: [],
  notice: null,
  selectedId: null,
  filter: 'all',
  label: DEFAULT_LABEL,
};

export function visibleRows(state: Pick<StudioState, 'rows' | 'filter'>): ValidatedRow[] {
  return state.filter === 'all' ? state.rows : state.rows.filter((r) => r.status === state.filter);
}

export function selectedRow(state: Pick<StudioState, 'rows' | 'selectedId'>): ValidatedRow | null {
  return state.rows.find((r) => r.id === state.selectedId) ?? null;
}

function firstSelectable(rows: ValidatedRow[]): string | null {
  return (rows.find((r) => r.status === 'ready') ?? rows[0])?.id ?? null;
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  const fresh: StudioState = { ...initialStudioState, label: state.label };
  const opts = validationFor(state.label);
  switch (action.type) {
    case 'loaded': {
      const parsed = action.content.kind === 'csv' ? parseTagCsv(action.content.text) : parseTagTable(action.content.rows);
      const source = { name: action.name, isSample: action.isSample ?? false };
      if (parsed.fileErrors.length > 0) {
        return { ...fresh, source, fileErrors: parsed.fileErrors, notice: action.notice ?? null };
      }
      const rows = validateRows(parsed.rows, opts);
      if (rows.length === 0) {
        return {
          ...fresh,
          source,
          fileErrors: ['No product rows found. Fill at least one row under the header row.'],
        };
      }
      return {
        ...fresh,
        source,
        rows,
        notice: action.notice ?? null,
        selectedId: firstSelectable(rows),
      };
    }

    case 'loadFailed':
      return { ...fresh, source: { name: action.name, isSample: false }, fileErrors: [action.error] };

    case 'setCopies': {
      const value = sanitizeCopiesInput(action.value);
      return {
        ...state,
        rows: state.rows.map((r) => (r.id === action.id ? withCopies(r, value, opts) : r)),
      };
    }

    case 'setAllCopies': {
      const value = sanitizeCopiesInput(action.value);
      if (value === '') return state;
      return { ...state, rows: state.rows.map((r) => withCopies(r, value, opts)) };
    }

    case 'select':
      return state.rows.some((r) => r.id === action.id) ? { ...state, selectedId: action.id } : state;

    case 'selectRelative': {
      const rows = visibleRows(state);
      if (rows.length === 0) return state;
      const index = rows.findIndex((r) => r.id === state.selectedId);
      const next = index === -1 ? 0 : Math.min(rows.length - 1, Math.max(0, index + action.delta));
      return { ...state, selectedId: rows[next].id };
    }

    case 'setFilter': {
      const next = { ...state, filter: action.filter };
      const rows = visibleRows(next);
      // Keep the selection if it is still visible; otherwise select the first visible row.
      if (!rows.some((r) => r.id === state.selectedId)) next.selectedId = rows[0]?.id ?? state.selectedId;
      return next;
    }

    case 'setLabel': {
      if (sameLabel(action.label, state.label)) return state;
      // Every row is checked again: a code can fit one label and be too long for another.
      const next = validationFor(action.label);
      return { ...state, label: action.label, rows: state.rows.map((r) => revalidate(r, next)) };
    }

    case 'clear':
      return fresh;

    default:
      return state;
  }
}
