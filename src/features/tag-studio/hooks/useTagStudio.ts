'use client';
import { useCallback, useMemo, useReducer, useState } from 'react';
import { assets } from '@/config/site';
import {
  TEMPLATE_CSV,
  expandTags,
  expandedCsvFileName,
  parseTagCsv,
  layoutTag,
  pdfFileName,
  renderTagsPdf,
  summarise,
  toExpandedCsv,
  type DrawOp,
} from '@/core/tags';
import { useToast } from '@/components/ui/Toaster';
import { downloadFile, downloadUrl } from '@/lib/browser/download';
import { readTagFile } from '@/lib/browser/read-tag-file';
import { initialStudioState, selectedRow, studioReducer, visibleRows, type RowFilter } from '../state/studio-reducer';
import { useTagFonts } from './useTagFonts';

export type ExportKind = 'test' | 'print' | 'preview' | 'csv';

/** Everything the Tag Studio screen needs: state, derived data and commands. */
export function useTagStudio() {
  const [state, dispatch] = useReducer(studioReducer, initialStudioState);
  const { fonts, error: fontError, retry: retryFonts } = useTagFonts();
  const { toast } = useToast();
  const [busy, setBusy] = useState<ExportKind | null>(null);

  const summary = useMemo(() => summarise(state.rows), [state.rows]);
  const rows = useMemo(() => visibleRows(state), [state]);
  const selected = selectedRow(state);

  const counts = useMemo<Record<RowFilter, number>>(
    () => ({ all: summary.total, ready: summary.ready, error: summary.errors, skipped: summary.skipped }),
    [summary],
  );

  /** Layout warnings per row (text too wide, characters the font cannot print). */
  const warnings = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!fonts) return map;
    for (const r of state.rows) {
      if (!r.tag) continue;
      const w = layoutTag(r.tag, fonts.metrics).warnings;
      if (w.length) map.set(r.id, w);
    }
    return map;
  }, [state.rows, fonts]);

  const previewOps: DrawOp[] | null = useMemo(
    () => (fonts && selected?.tag ? layoutTag(selected.tag, fonts.metrics).ops : null),
    [fonts, selected],
  );

  // ---- loading -----------------------------------------------------------------------------

  const [loading, setLoading] = useState(false);

  const openFile = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const result = await readTagFile(file);
        if (!result.ok) {
          dispatch({ type: 'loadFailed', name: file.name, error: result.error });
          toast({ tone: 'error', title: `Could not open ${file.name}`, description: result.error });
          return;
        }
        dispatch({ type: 'loaded', name: file.name, content: result.content, notice: result.notice });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const fetchSampleCsv = useCallback(async () => {
    const res = await fetch(assets.sampleCsv.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }, []);

  const loadSample = useCallback(async () => {
    try {
      dispatch({
        type: 'loaded',
        name: assets.sampleCsv.fileName,
        content: { kind: 'csv', text: await fetchSampleCsv() },
        isSample: true,
      });
    } catch (e) {
      toast({ tone: 'error', title: 'Could not load the sample', description: e instanceof Error ? e.message : String(e) });
    }
  }, [fetchSampleCsv, toast]);

  // Excel template / sample (colour-coded). ExcelJS is loaded only when one is requested.
  const [preparing, setPreparing] = useState<'sample' | 'template' | null>(null);
  const downloadWorkbook = useCallback(
    async (which: 'sample' | 'template') => {
      setPreparing(which);
      try {
        const { buildTagsWorkbook, XLSX_MIME } = await import('@/core/tags/xlsx');
        const rows = which === 'sample' ? parseTagCsv(await fetchSampleCsv()).rows : [];
        const bytes = await buildTagsWorkbook(rows);
        const name = which === 'sample' ? assets.sampleXlsx.fileName : assets.templateXlsx.fileName;
        downloadFile(bytes, name, XLSX_MIME);
        toast({
          tone: 'success',
          title: which === 'sample' ? 'Sample Excel downloaded' : 'Excel template downloaded',
          description: 'Fill one row per product (green columns are required), save, then open it here.',
        });
      } catch (e) {
        toast({ tone: 'error', title: 'Could not make the Excel file', description: e instanceof Error ? e.message : String(e) });
      } finally {
        setPreparing(null);
      }
    },
    [fetchSampleCsv, toast],
  );
  const downloadSampleXlsx = useCallback(() => downloadWorkbook('sample'), [downloadWorkbook]);
  const downloadTemplateXlsx = useCallback(() => downloadWorkbook('template'), [downloadWorkbook]);

  // Plain CSV versions stay available.
  const downloadSampleCsv = useCallback(() => downloadUrl(assets.sampleCsv.url, assets.sampleCsv.fileName), []);
  const downloadTemplateCsv = useCallback(
    () => downloadFile(TEMPLATE_CSV, assets.templateCsv.fileName, 'text/csv;charset=utf-8'),
    [],
  );

  // ---- row edits ---------------------------------------------------------------------------

  const setCopies = useCallback((id: string, value: string) => dispatch({ type: 'setCopies', id, value }), []);
  const setAllCopies = useCallback((value: string) => dispatch({ type: 'setAllCopies', value }), []);
  const select = useCallback((id: string) => dispatch({ type: 'select', id }), []);
  const selectRelative = useCallback((delta: number) => dispatch({ type: 'selectRelative', delta }), []);
  const setFilter = useCallback((filter: RowFilter) => dispatch({ type: 'setFilter', filter }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  // ---- exports -----------------------------------------------------------------------------

  const exportFile = useCallback(
    async (kind: ExportKind) => {
      const now = new Date();
      if (kind === 'csv') {
        const tags = expandTags(state.rows);
        downloadFile(toExpandedCsv(tags), expandedCsvFileName(now, tags.length), 'text/csv;charset=utf-8');
        toast({ tone: 'success', title: 'Expanded CSV downloaded', description: `${tags.length} rows, one per label.` });
        return;
      }
      if (!fonts) return;
      setBusy(kind);
      try {
        // Let the button show its spinner before the PDF work starts.
        await new Promise((r) => setTimeout(r, 0));
        const tags = kind === 'print' ? expandTags(state.rows) : expandTags(state.rows, 1);
        const bytes = await renderTagsPdf(tags, {
          mode: kind === 'preview' ? 'preview' : 'print',
          fonts: fonts.fonts,
          metrics: fonts.metrics,
          title: `KSH tags – ${state.source?.name ?? ''}`,
        });
        const fileKind = kind === 'print' ? 'print' : kind === 'test' ? 'TEST-1-each' : 'preview';
        downloadFile(bytes, pdfFileName(fileKind, now, tags.length), 'application/pdf');
        toast(
          kind === 'preview'
            ? {
                tone: 'info',
                title: `Preview PDF downloaded (${tags.length} pages)`,
                description: 'For checking on screen only. Do not print this one.',
              }
            : {
                tone: 'success',
                title: `${kind === 'test' ? 'Test print' : 'Print'} PDF downloaded (${tags.length} pages)`,
                description: 'Print at Actual size / 100% on 75 × 125 mm, portrait.',
              },
        );
      } catch (e) {
        toast({ tone: 'error', title: 'Could not make the PDF', description: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(null);
      }
    },
    [state.rows, state.source, fonts, toast],
  );

  return {
    state,
    rows,
    selected,
    summary,
    counts,
    warnings,
    previewOps,
    fontsReady: fonts !== null,
    fontError,
    retryFonts,
    busy,
    openFile,
    loadSample,
    downloadSampleCsv,
    downloadTemplateCsv,
    downloadSampleXlsx,
    downloadTemplateXlsx,
    preparing,
    loading,
    setCopies,
    setAllCopies,
    select,
    selectRelative,
    setFilter,
    clear,
    exportFile,
  };
}

export type TagStudio = ReturnType<typeof useTagStudio>;
