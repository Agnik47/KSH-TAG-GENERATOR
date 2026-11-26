'use client';
import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileUp, PlayCircle, TriangleAlert, Upload } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { TAG_FILE_ACCEPT } from '@/lib/browser/read-tag-file';
import { labelName } from '@/core/tags';
import { cn } from '@/lib/utils/cn';
import { useTagStudio } from '../hooks/useTagStudio';
import { ActionsPanel } from './ActionsPanel';
import { EmptyState } from './EmptyState';
import { LabelPicker } from './LabelPicker';
import { PreviewPanel } from './PreviewPanel';
import { PrintGuide } from './PrintGuide';
import { RowsTable } from './RowsTable';
import { RowsToolbar } from './RowsToolbar';

/**
 * The Tag Studio screen: navbar on top; below it the rows (left) and the preview + print
 * actions (right). On large screens both panes scroll independently.
 */
export function TagStudio() {
  const studio = useTagStudio();
  const { state, rows, selected, summary } = studio;
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hasRows = state.rows.length > 0;

  const openPicker = () => fileInput.current?.click();

  /** "Row" = the row number in the uploaded file (Excel row / CSV line), so errors are easy to find there. */
  const rowNumbers = useMemo(() => new Map(state.rows.map((r) => [r.id, r.raw.line])), [state.rows]);

  const position = useMemo(() => {
    const index = rows.findIndex((r) => r.id === state.selectedId);
    return index === -1 ? null : { index: index + 1, total: rows.length };
  }, [rows, state.selectedId]);

  return (
    <div
      className="flex min-h-dvh flex-col lg:h-dvh"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void studio.openFile(file);
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept={TAG_FILE_ACCEPT}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void studio.openFile(file);
          e.target.value = ''; // allow loading the same file again
        }}
      />

      <AppHeader
        actions={
          <>
            <Button
              variant="ghost"
              icon={<FileSpreadsheet className="size-4 text-emerald-700" />}
              loading={studio.preparing === 'sample'}
              onClick={studio.downloadSampleXlsx}
              title="Download the colour-coded Excel sample (20 products) to fill with your data"
            >
              <span className="sr-only md:not-sr-only">Sample Excel</span>
            </Button>
            <Button
              variant="ghost"
              icon={<Download className="size-4" />}
              loading={studio.preparing === 'template'}
              onClick={studio.downloadTemplateXlsx}
              title="Download a blank, colour-coded Excel template"
            >
              <span className="sr-only md:not-sr-only">Template</span>
            </Button>
            <Button
              variant="ghost"
              icon={<PlayCircle className="size-4" />}
              onClick={studio.loadSample}
              title="Load the sample into the app"
            >
              <span className="sr-only lg:not-sr-only">Try sample</span>
            </Button>
            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
            <Button
              variant="primary"
              icon={<Upload className="size-4" />}
              loading={studio.loading}
              onClick={openPicker}
              title="Open an Excel (.xlsx) or CSV file"
            >
              Open file
            </Button>
          </>
        }
      />

      {studio.fontError && (
        <div role="alert" className="flex items-center gap-3 border-b border-rose-200 bg-rose-50 px-6 py-2 text-sm text-rose-800">
          <TriangleAlert className="size-4" aria-hidden />
          Fonts could not be loaded ({studio.fontError}). Tags cannot be made until they load.
          <Button size="sm" onClick={studio.retryFonts}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Left: rows */}
        <main className="flex min-w-0 flex-col bg-slate-50 lg:min-h-0">
          {hasRows ? (
            <>
              <RowsToolbar
                source={state.source}
                notice={state.notice}
                summary={summary}
                sizeErrors={studio.sizeErrors}
                counts={studio.counts}
                filter={state.filter}
                onFilter={studio.setFilter}
                onSetAllCopies={studio.setAllCopies}
                onReplace={openPicker}
                onClear={studio.clear}
              />
              <div className="overflow-auto bg-white lg:min-h-0 lg:flex-1">
                <RowsTable
                  rows={rows}
                  rowNumbers={rowNumbers}
                  selectedId={state.selectedId}
                  warnings={studio.warnings}
                  onSelect={studio.select}
                  onSelectRelative={studio.selectRelative}
                  onCopies={studio.setCopies}
                />
              </div>
            </>
          ) : (
            <div className="px-4 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <EmptyState
                fileName={state.source?.name ?? null}
                fileErrors={state.fileErrors}
                onOpenFile={openPicker}
                onDropFile={(f) => void studio.openFile(f)}
                onDownloadSample={studio.downloadSampleXlsx}
                onDownloadSampleCsv={studio.downloadSampleCsv}
                onDownloadTemplateCsv={studio.downloadTemplateCsv}
                preparing={studio.preparing}
                onDownloadTemplate={studio.downloadTemplateXlsx}
                onLoadSample={studio.loadSample}
              />
            </div>
          )}
        </main>

        {/* Right: preview + actions */}
        <aside
          aria-label="Preview and print"
          className="border-t border-slate-200 bg-slate-100/60 lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          <div className="space-y-4 p-4 sm:p-5">
            <LabelPicker label={state.label} geometry={studio.geometry} tooLong={studio.tooLong} onChange={studio.setLabel} />
            <PreviewPanel
              row={selected}
              ops={studio.previewOps}
              warnings={selected ? (studio.warnings.get(selected.id) ?? []) : []}
              position={position}
              fontsReady={studio.fontsReady}
              geometry={studio.geometry}
              onPrev={() => studio.selectRelative(-1)}
              onNext={() => studio.selectRelative(1)}
            />
            <ActionsPanel
              summary={summary}
              labelText={labelName(state.label)}
              designText={`${studio.geometry.w} × ${studio.geometry.h}`}
              fontsReady={studio.fontsReady}
              busy={studio.busy}
              onExport={studio.exportFile}
            />
            <PrintGuide label={state.label} />
          </div>
        </aside>
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-emerald-900/20 p-6 backdrop-blur-[1px]">
          <div
            className={cn(
              'flex flex-col items-center rounded-2xl border-2 border-dashed border-emerald-500 bg-white px-10 py-8 shadow-xl',
            )}
          >
            <FileUp className="size-8 text-emerald-700" aria-hidden />
            <p className="mt-2 text-lg font-semibold text-slate-900">Drop the file to load it</p>
          </div>
        </div>
      )}
    </div>
  );
}
