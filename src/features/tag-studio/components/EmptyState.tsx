'use client';
import { useState } from 'react';
import { Download, FileSpreadsheet, FileUp, PlayCircle, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

interface Props {
  fileName: string | null;
  fileErrors: string[];
  preparing: 'sample' | 'template' | null;
  onOpenFile: () => void;
  onDropFile: (file: File) => void;
  onDownloadSample: () => void;
  onDownloadTemplate: () => void;
  onDownloadSampleCsv: () => void;
  onDownloadTemplateCsv: () => void;
  onLoadSample: () => void;
}

const STEPS = [
  {
    title: 'Fill the Excel sheet',
    text: 'Download the sample or template. Fill one row per product. Red cells point out mistakes.',
  },
  { title: 'Load it here', text: 'Drop the Excel (or CSV) file on this page. Every row is checked; errors are never printed.' },
  { title: 'Print', text: 'Test print one tag each, scan them at the POS, then download the full print PDF.' },
];

/** The colours used in the Excel template, explained on screen too. */
const LEGEND = [
  { swatch: 'bg-emerald-700', label: 'Required', cols: 'ScanIdentifier, ProductName, MRP, OurPrice' },
  { swatch: 'bg-sky-700', label: 'Old Wishkaro tags only', cols: 'Color, Size' },
  { swatch: 'bg-amber-600', label: 'Number of tags', cols: 'Copies (empty = 1)' },
  { swatch: 'bg-red-200 ring-1 ring-red-400', label: 'Mistake', cols: 'fix before loading' },
];

export function EmptyState({
  fileName,
  fileErrors,
  preparing,
  onOpenFile,
  onDropFile,
  onDownloadSample,
  onDownloadTemplate,
  onDownloadSampleCsv,
  onDownloadTemplateCsv,
  onLoadSample,
}: Props) {
  const [over, setOver] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 sm:py-10">
      {fileErrors.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" aria-hidden />
            {fileName ? `${fileName} could not be used` : 'The file could not be used'}
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-6">
            {fileErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2 text-rose-700">Tip: download the sample Excel to see the expected columns.</p>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label="Choose an Excel or CSV file, or drop it here"
        onClick={onOpenFile}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenFile();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onDropFile(file);
        }}
        className={cn(
          'group flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
          over ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50/60',
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/50">
          <FileUp className="size-7" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold text-slate-900">Drop your Excel or CSV file here</p>
        <p className="mt-1 text-sm text-slate-600">
          or <span className="font-semibold text-emerald-700 underline underline-offset-2">choose a file</span> (.xlsx or .csv)
        </p>
        <p className="mt-3 text-xs text-slate-500">The file stays on this computer. Nothing is uploaded.</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            icon={<FileSpreadsheet className="size-4" />}
            loading={preparing === 'sample'}
            onClick={onDownloadSample}
          >
            Download sample (Excel)
          </Button>
          <Button icon={<Download className="size-4" />} loading={preparing === 'template'} onClick={onDownloadTemplate}>
            Blank template (Excel)
          </Button>
          <Button variant="ghost" icon={<PlayCircle className="size-4" />} onClick={onLoadSample}>
            Try the sample now
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Prefer CSV?{' '}
          <button
            type="button"
            className="font-medium text-emerald-700 underline underline-offset-2"
            onClick={onDownloadSampleCsv}
          >
            sample.csv
          </button>{' '}
          ·{' '}
          <button
            type="button"
            className="font-medium text-emerald-700 underline underline-offset-2"
            onClick={onDownloadTemplateCsv}
          >
            template.csv
          </button>
        </p>
      </div>

      <section aria-labelledby="legend-title" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="legend-title" className="text-sm font-semibold text-slate-900">
          Colours in the Excel template
        </h2>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex items-start gap-2.5 text-sm">
              <span className={cn('mt-0.5 size-4 shrink-0 rounded', l.swatch)} aria-hidden />
              <span>
                <span className="font-medium text-slate-900">{l.label}</span>
                <span className="block text-xs text-slate-500">{l.cols}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                {i + 1}
              </span>
              {s.title}
            </p>
            <p className="mt-1.5 text-sm text-slate-600">{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
