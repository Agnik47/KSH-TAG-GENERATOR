'use client';
import { useState } from 'react';
import { FileText, Info, RefreshCw, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { sanitizeCopiesInput, type Summary } from '@/core/tags';
import { cn } from '@/lib/utils/cn';
import type { RowFilter, StudioSource } from '../state/studio-reducer';

interface Props {
  source: StudioSource | null;
  notice: string | null;
  summary: Summary;
  /** Error rows whose only problem is a barcode too long for the chosen label size. */
  sizeErrors: number;
  counts: Record<RowFilter, number>;
  filter: RowFilter;
  onFilter: (f: RowFilter) => void;
  onSetAllCopies: (value: string) => void;
  onReplace: () => void;
  onClear: () => void;
}

const FILTERS: Array<{ id: RowFilter; label: string; tone: string }> = [
  { id: 'all', label: 'All', tone: 'text-slate-700' },
  { id: 'ready', label: 'Ready', tone: 'text-emerald-700' },
  { id: 'error', label: 'Errors', tone: 'text-rose-700' },
  { id: 'skipped', label: 'Skipped', tone: 'text-slate-500' },
];

export function RowsToolbar({
  source,
  notice,
  summary,
  sizeErrors,
  counts,
  filter,
  onFilter,
  onSetAllCopies,
  onReplace,
  onClear,
}: Props) {
  const [bulk, setBulk] = useState('');

  const applyBulk = () => {
    if (bulk === '') return;
    onSetAllCopies(bulk);
    setBulk('');
  };

  return (
    <div className="space-y-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      {/* File + totals */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate text-sm font-semibold text-slate-900" title={source?.name}>
            {source?.name}
          </span>
          {source?.isSample && <Badge tone="info">Sample</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={onReplace}>
            Replace file
          </Button>
          <Button size="sm" variant="danger" icon={<X className="size-3.5" />} onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>

      {notice && (
        <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Filter tabs */}
        <div role="tablist" aria-label="Filter rows" className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilter(f.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                  active ? 'bg-white shadow-sm' : 'hover:bg-white/60',
                  active ? f.tone : 'text-slate-600',
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'rounded px-1 text-xs tabular-nums',
                    f.id === 'error' && counts.error > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200/70 text-slate-600',
                  )}
                >
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Total labels */}
        <p className="text-sm text-slate-600">
          <span className="text-lg font-semibold text-slate-900 tabular-nums">{summary.labels.toLocaleString('en-IN')}</span>{' '}
          labels to print
        </p>

        {/* Bulk copies */}
        <form
          className="ml-auto flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            applyBulk();
          }}
        >
          <label htmlFor="bulk-copies" className="text-sm text-slate-600">
            Set all copies
          </label>
          <input
            id="bulk-copies"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            autoComplete="off"
            placeholder="e.g. 2"
            value={bulk}
            onChange={(e) => setBulk(sanitizeCopiesInput(e.target.value))}
            className="h-8 w-16 rounded-md border border-slate-300 px-2 text-right text-sm tabular-nums focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
          />
          <Button size="sm" type="submit" disabled={bulk === ''}>
            Apply
          </Button>
        </form>
      </div>

      {summary.errors > 0 && (
        <p className="text-sm text-rose-700">
          {summary.errors} row{summary.errors === 1 ? ' has' : 's have'} errors and will not be printed.{' '}
          {sizeErrors === summary.errors
            ? 'Their barcodes are too long for this label size: choose a bigger label on the right.'
            : 'Fix them in your file (the Row number shows where) and load it again.'}
        </p>
      )}
    </div>
  );
}
