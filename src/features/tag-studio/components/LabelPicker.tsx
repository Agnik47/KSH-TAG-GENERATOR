'use client';
import { useState } from 'react';
import { RectangleHorizontal, RectangleVertical, Ruler, TriangleAlert } from 'lucide-react';
import {
  LABEL_LIMITS,
  LABEL_PRESETS,
  checkCustomSize,
  labelName,
  presetFor,
  type LabelSpec,
  type Orientation,
  type TagGeometry,
} from '@/core/tags';
import { cn } from '@/lib/utils/cn';

interface Props {
  label: LabelSpec;
  geometry: TagGeometry;
  /** Rows whose barcode is too long for this label. */
  tooLong: number;
  onChange: (label: LabelSpec) => void;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const chip = (active: boolean) =>
  cn(
    'flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
    active
      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
  );

/** Choose the label size (presets or custom) and whether the tag reads horizontally or vertically. */
export function LabelPicker({ label, geometry, tooLong, onChange }: Props) {
  const preset = presetFor(label);
  const [customOpen, setCustomOpen] = useState(false);
  const isCustom = customOpen || !preset;
  const [draft, setDraft] = useState({ w: fmt(label.widthMm), l: fmt(label.lengthMm) });
  const [customError, setCustomError] = useState<string | null>(null);
  // When the label changes from outside (e.g. restored from last time), show its numbers.
  const [shown, setShown] = useState(label);
  if (shown !== label) {
    setShown(label);
    setDraft({ w: fmt(label.widthMm), l: fmt(label.lengthMm) });
  }

  const applyCustom = () => {
    const widthMm = Number(draft.w);
    const lengthMm = Number(draft.l);
    const error = checkCustomSize(widthMm, lengthMm);
    setCustomError(error);
    if (!error) onChange({ ...label, widthMm, lengthMm });
  };

  const setOrientation = (orientation: Orientation) => onChange({ ...label, orientation });

  return (
    <section aria-labelledby="label-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <h2 id="label-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Ruler className="size-4 text-slate-500" aria-hidden />
        Label size
        <span className="ml-auto text-xs font-normal text-slate-500">width × length</span>
      </h2>

      <div role="radiogroup" aria-label="Label size" className="mt-3 grid grid-cols-2 gap-2">
        {LABEL_PRESETS.map((p) => {
          const active = !isCustom && preset?.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={chip(active)}
              onClick={() => {
                setCustomOpen(false);
                setCustomError(null);
                onChange({ ...label, widthMm: p.widthMm, lengthMm: p.lengthMm });
              }}
            >
              <span className="text-sm font-semibold tabular-nums">
                {p.widthMm} × {p.lengthMm} mm
              </span>
              <span className={cn('text-xs', active ? 'text-emerald-800' : 'text-slate-500')}>{p.note}</span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={isCustom}
          className={chip(isCustom)}
          onClick={() => {
            setCustomOpen(true);
            setDraft({ w: fmt(label.widthMm), l: fmt(label.lengthMm) });
          }}
        >
          <span className="text-sm font-semibold">Custom</span>
          <span className={cn('text-xs', isCustom ? 'text-emerald-800' : 'text-slate-500')}>
            {isCustom ? labelName(label) : 'Any size in mm'}
          </span>
        </button>
      </div>

      {isCustom && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            applyCustom();
          }}
        >
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-slate-600">
              Width
              <input
                inputMode="decimal"
                value={draft.w}
                onChange={(e) => setDraft((d) => ({ ...d, w: e.target.value.replace(/[^\d.]/g, '') }))}
                aria-invalid={customError !== null}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm tabular-nums focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
            </label>
            <span className="pb-2 text-slate-400" aria-hidden>
              ×
            </span>
            <label className="flex-1 text-xs text-slate-600">
              Length
              <input
                inputMode="decimal"
                value={draft.l}
                onChange={(e) => setDraft((d) => ({ ...d, l: e.target.value.replace(/[^\d.]/g, '') }))}
                aria-invalid={customError !== null}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm tabular-nums focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
            </label>
            <span className="pb-2 text-xs text-slate-500">mm</span>
            <button
              type="submit"
              className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Apply
            </button>
          </div>
          <p
            className={cn('mt-1.5 text-xs', customError ? 'text-rose-700' : 'text-slate-500')}
            role={customError ? 'alert' : undefined}
          >
            {customError ?? `Width is across the printer: ${LABEL_LIMITS.minMm}–${LABEL_LIMITS.maxWidthMm} mm.`}
          </p>
        </form>
      )}

      <div role="radiogroup" aria-label="Tag direction" className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {(
          [
            ['horizontal', 'Horizontal', RectangleHorizontal],
            ['vertical', 'Vertical', RectangleVertical],
          ] as const
        ).map(([value, text, Icon]) => {
          const active = label.orientation === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setOrientation(value)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600',
                active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {text}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-600">
        Tag {fmt(geometry.w)} × {fmt(geometry.h)} mm
        {geometry.rotated ? ', printed turned 90° on the label' : ''}.{' '}
        {geometry.symbology === 'qr'
          ? 'Small QR tag: store name, product name, QR code, MRP, price, Mfd month, code and Mfg/Mkt line.'
          : `Line barcode, room ${Math.floor(geometry.barcodeRoomMm)} mm.`}
      </p>
      {tooLong > 0 && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            {tooLong} {tooLong === 1 ? 'row has a code' : 'rows have codes'} too long for this size. They show as errors and will
            not print. {label.orientation === 'vertical' ? 'Try Horizontal or a longer label.' : 'Choose a longer label.'}
          </span>
        </p>
      )}
    </section>
  );
}
