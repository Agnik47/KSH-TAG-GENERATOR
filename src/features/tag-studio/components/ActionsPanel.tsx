'use client';
import { Eye, FileDown, Printer, TestTube2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Summary } from '@/core/tags';
import { cn } from '@/lib/utils/cn';
import type { ExportKind } from '../hooks/useTagStudio';

interface Props {
  summary: Summary;
  /** "51 × 32 mm" — the label the print PDF is made for. */
  labelText: string;
  /** Design size, e.g. "125 × 75". */
  designText: string;
  fontsReady: boolean;
  busy: ExportKind | null;
  onExport: (kind: ExportKind) => void;
}

/** Above this many pages we tell people the PDF is big (it still works). */
const LARGE_JOB_PAGES = 1000;

const plural = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

function ActionRow({
  title,
  hint,
  icon,
  primary,
  disabled,
  loading,
  onClick,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  primary?: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        primary
          ? 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800'
          : 'border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          primary ? 'bg-white/15' : 'bg-slate-100 text-slate-600',
        )}
      >
        {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{loading ? 'Making the file…' : title}</span>
        <span className={cn('block text-xs', primary ? 'text-emerald-100' : 'text-slate-500')}>{hint}</span>
      </span>
    </button>
  );
}

export function ActionsPanel({ summary, labelText, designText, fontsReady, busy, onExport }: Props) {
  const noRows = summary.ready === 0;
  const pdfDisabled = noRows || !fontsReady || busy !== null;

  return (
    <section aria-labelledby="actions-title" className="space-y-2">
      <h2 id="actions-title" className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Print
      </h2>
      <ActionRow
        title="Test print (1 each)"
        hint={`${plural(summary.ready, 'page')} · one tag per product, scan each at the POS`}
        icon={<TestTube2 className="size-4.5" aria-hidden />}
        disabled={pdfDisabled}
        loading={busy === 'test'}
        onClick={() => onExport('test')}
      />
      <ActionRow
        primary
        title="Download print PDF"
        hint={`${plural(summary.labels, 'page')} · ${labelText} · one page per copy`}
        icon={<Printer className="size-4.5" aria-hidden />}
        disabled={pdfDisabled || summary.labels === 0}
        loading={busy === 'print'}
        onClick={() => onExport('print')}
      />
      {summary.labels > LARGE_JOB_PAGES && (
        <p className="px-1 text-xs text-amber-700">
          Large job: {plural(summary.labels, 'page')}. Making the PDF can take a few seconds.
        </p>
      )}

      <h2 className="px-1 pt-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Other files</h2>
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-auto flex-col items-start gap-0.5 py-2.5 text-left"
          disabled={pdfDisabled}
          loading={busy === 'preview'}
          onClick={() => onExport('preview')}
        >
          <span className="flex items-center gap-1.5">
            {busy !== 'preview' && <Eye className="size-4" aria-hidden />}
            Preview PDF
          </span>
          <span className="text-xs font-normal text-slate-500">{designText}, on screen</span>
        </Button>
        <Button
          className="h-auto flex-col items-start gap-0.5 py-2.5 text-left"
          disabled={noRows || summary.labels === 0 || busy !== null}
          onClick={() => onExport('csv')}
        >
          <span className="flex items-center gap-1.5">
            <FileDown className="size-4" aria-hidden />
            Expanded CSV
          </span>
          <span className="text-xs font-normal text-slate-500">one row per label</span>
        </Button>
      </div>
    </section>
  );
}
