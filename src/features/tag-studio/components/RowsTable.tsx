'use client';
import { Fragment, useEffect, useRef } from 'react';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ERR, formatMrp, formatRupees, type ValidatedRow } from '@/core/tags';
import { cn } from '@/lib/utils/cn';
import { CopiesInput } from './CopiesInput';

interface Props {
  rows: ValidatedRow[];
  /** Row number shown in the first column = row in the uploaded file (Excel row / CSV line). */
  rowNumbers: Map<string, number>;
  selectedId: string | null;
  warnings: Map<string, string[]>;
  onSelect: (id: string) => void;
  onSelectRelative: (delta: number) => void;
  onCopies: (id: string, value: string) => void;
}

const COLUMNS = 10;

function StatusBadge({ row }: { row: ValidatedRow }) {
  if (row.status === 'error') return <Badge tone="danger">Error</Badge>;
  if (row.status === 'skipped') return <Badge tone="neutral">Skipped</Badge>;
  return <Badge tone="success">Ready</Badge>;
}

export function RowsTable({ rows, rowNumbers, selectedId, warnings, onSelect, onSelectRelative, onCopies }: Props) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  // Keep the selected row visible when it changes (keyboard navigation, prev/next buttons).
  useEffect(() => {
    if (!selectedId) return;
    bodyRef.current
      ?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (rows.length === 0) {
    return <p className="px-6 py-16 text-center text-sm text-slate-500">No rows match this filter.</p>;
  }

  return (
    <table
      className="w-full min-w-[780px] border-separate border-spacing-0 text-sm"
      aria-label="Tag rows. Use the up and down arrow keys to move between rows."
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          onSelectRelative(e.key === 'ArrowDown' ? 1 : -1);
        }
      }}
    >
      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2.5 [&>th]:py-2.5">
          <th className="w-12 pl-4! sm:pl-6!" title="Row number in your file">
            Row
          </th>
          <th>ScanIdentifier</th>
          <th>Product name</th>
          <th>Color</th>
          <th>Size</th>
          <th className="text-right">MRP</th>
          <th className="text-right">Our price</th>
          <th className="text-right">You save</th>
          <th>Copies</th>
          <th className="pr-4! sm:pr-6!">Status</th>
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {rows.map((row) => {
          const t = row.tag;
          const selected = row.id === selectedId;
          const rowWarnings = warnings.get(row.id) ?? [];
          const notes = row.status === 'error' ? row.errors : rowWarnings;
          const cellBg = selected
            ? 'bg-emerald-50'
            : row.status === 'error'
              ? 'bg-rose-50/50 group-hover:bg-rose-50'
              : 'bg-white group-hover:bg-slate-50';
          const cell = cn('px-2.5 py-2.5 align-middle', cellBg, !notes.length && 'border-b border-slate-100');

          return (
            <Fragment key={row.id}>
              <tr
                data-row-id={row.id}
                aria-selected={selected}
                onClick={() => onSelect(row.id)}
                className={cn('group cursor-pointer', row.status === 'skipped' && 'text-slate-400')}
              >
                <td
                  className={cn(
                    cell,
                    'pl-4 text-slate-400 tabular-nums sm:pl-6',
                    selected && 'shadow-[inset_3px_0_0_var(--color-emerald-600)]',
                  )}
                >
                  {rowNumbers.get(row.id)}
                </td>
                <td className={cn(cell, 'font-mono text-xs whitespace-nowrap')}>
                  {row.raw.scanIdentifier || <em className="font-sans text-rose-600">empty</em>}
                </td>
                <td className={cn(cell, 'min-w-32')}>{row.raw.productName || <em className="text-rose-600">empty</em>}</td>
                <td className={cell}>{row.raw.color}</td>
                <td className={cn(cell, 'whitespace-nowrap')}>{row.raw.size}</td>
                <td className={cn(cell, 'text-right whitespace-nowrap tabular-nums', t && 'text-slate-500')}>
                  {t ? formatMrp(t.mrp) : row.raw.mrp}
                </td>
                <td className={cn(cell, 'text-right font-semibold whitespace-nowrap tabular-nums')}>
                  {t ? formatRupees(t.ourPrice) : row.raw.ourPrice}
                </td>
                <td className={cn(cell, 'text-right whitespace-nowrap text-emerald-700 tabular-nums')}>
                  {t ? formatRupees(t.youSave) : ''}
                </td>
                <td className={cn(cell, 'py-1.5')}>
                  <CopiesInput
                    value={row.copiesText}
                    invalid={row.errors.includes(ERR.badCopies)}
                    label={`Copies for row ${rowNumbers.get(row.id)}`}
                    onChange={(v) => onCopies(row.id, v)}
                    onFocus={() => onSelect(row.id)}
                  />
                </td>
                <td className={cn(cell, 'pr-4 sm:pr-6')}>
                  <span className="flex items-center gap-1.5">
                    <StatusBadge row={row} />
                    {row.status !== 'error' && rowWarnings.length > 0 && (
                      <TriangleAlert className="size-4 text-amber-500" aria-label="Has warnings" />
                    )}
                  </span>
                </td>
              </tr>
              {notes.length > 0 && (
                <tr className="group cursor-pointer" onClick={() => onSelect(row.id)}>
                  <td
                    className={cn(
                      cellBg,
                      'border-b border-slate-100',
                      selected && 'shadow-[inset_3px_0_0_var(--color-emerald-600)]',
                    )}
                  />
                  <td
                    colSpan={COLUMNS - 1}
                    className={cn(
                      cellBg,
                      'border-b border-slate-100 px-3 pt-0 pb-2.5 text-xs',
                      row.status === 'error' ? 'text-rose-700' : 'text-amber-700',
                    )}
                  >
                    <span className="flex items-start gap-1.5">
                      {row.status === 'error' ? (
                        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                      ) : (
                        <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                      )}
                      <span>
                        {row.status === 'error' && <strong>Not printed: </strong>}
                        {notes.join(' · ')}
                      </span>
                    </span>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
