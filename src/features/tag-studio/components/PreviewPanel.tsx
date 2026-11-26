'use client';
import { ChevronLeft, ChevronRight, CircleAlert, ImageOff, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DOT_MM, encodeCode128, encodeQr, type DrawOp, type TagGeometry, type ValidatedRow } from '@/core/tags';
import { TagPreview } from './TagPreview';

interface Props {
  row: ValidatedRow | null;
  ops: DrawOp[] | null;
  warnings: string[];
  /** 1-based position of the row in the current list, and the list length. */
  position: { index: number; total: number } | null;
  fontsReady: boolean;
  geometry: TagGeometry;
  onPrev: () => void;
  onNext: () => void;
}

function barcodeInfo(row: ValidatedRow, geometry: TagGeometry): string | null {
  if (!row.tag) return null;
  if (geometry.symbology === 'qr') {
    const { n } = encodeQr(row.tag.scanIdentifier);
    const square = row.tag.barcodeDots * DOT_MM;
    return `QR ${n} × ${n} · ${square.toFixed(2)} mm squares · ${(n * square).toFixed(1)} mm`;
  }
  const { modules } = encodeCode128(row.tag.scanIdentifier);
  const width = modules * row.tag.barcodeDots * DOT_MM;
  return `${row.tag.barcodeDots}-dot bars · ${width.toFixed(1)} mm wide`;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Tall previews are limited to this height (px) so the print buttons stay in view. */
const MAX_PREVIEW_PX = 380;

export function PreviewPanel({ row, ops, warnings, position, fontsReady, geometry, onPrev, onNext }: Props) {
  const { w, h } = geometry;
  // Landscape tags use the full panel width; tall tags are narrowed so they are at most MAX_PREVIEW_PX high.
  const frameStyle = h > w ? { maxWidth: `${Math.round((MAX_PREVIEW_PX * w) / h)}px` } : undefined;
  return (
    <section aria-labelledby="preview-title" className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 id="preview-title" className="text-sm font-semibold text-slate-900">
          Tag preview
        </h2>
        {position && (
          <span className="text-xs text-slate-500 tabular-nums">
            {position.index} of {position.total}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Previous row"
            disabled={!position || position.index <= 1}
            onClick={onPrev}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Next row"
            disabled={!position || position.index >= position.total}
            onClick={onNext}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div
          className="mx-auto overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.08)]"
          style={frameStyle}
        >
          {ops ? (
            <TagPreview ops={ops} width={w} height={h} />
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 bg-slate-50 p-4 text-center text-sm text-slate-500"
              style={{ aspectRatio: `${w} / ${h}` }}
            >
              {row?.status === 'error' ? (
                <>
                  <CircleAlert className="size-6 text-rose-500" aria-hidden />
                  <span className="text-rose-700">This row has errors and will not be printed.</span>
                </>
              ) : (
                <>
                  <ImageOff className="size-6" aria-hidden />
                  {!fontsReady ? 'Loading fonts…' : row ? 'No preview' : 'Load an Excel or CSV file to see the tags here.'}
                </>
              )}
            </div>
          )}
        </div>

        {row && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-slate-500">Barcode</dt>
            <dd className="truncate font-mono text-slate-800">{row.raw.scanIdentifier || '—'}</dd>
            {row.tag && (
              <>
                <dt className="text-slate-500">Type</dt>
                <dd className="text-slate-800">
                  {row.tag.layout === 'old' ? 'Old Wishkaro style (colour + size)' : 'New KSH Surplus'}
                </dd>
                <dt className="text-slate-500">{geometry.symbology === 'qr' ? 'Code' : 'Bars'}</dt>
                <dd className="text-slate-800">{barcodeInfo(row, geometry)}</dd>
              </>
            )}
            <dt className="text-slate-500">Copies</dt>
            <dd>
              {row.status === 'ready' ? (
                <span className="font-semibold text-slate-900">{row.copies}</span>
              ) : row.status === 'skipped' ? (
                <Badge>Skipped (0)</Badge>
              ) : (
                <Badge tone="danger">Not printed</Badge>
              )}
            </dd>
          </dl>
        )}

        {row?.status === 'error' && (
          <ul className="mt-3 space-y-1 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {row.errors.map((e) => (
              <li key={e} className="flex items-center gap-2">
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                {e}
              </li>
            ))}
          </ul>
        )}
        {row?.status !== 'error' && warnings.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {warnings.map((w) => (
              <li key={w} className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Tag {fmt(w)} × {fmt(h)} mm{geometry.rotated ? '. On the roll it prints turned 90°' : ''}. Use ↑ ↓ in the table to move
          between rows.
        </p>
      </div>
    </section>
  );
}
