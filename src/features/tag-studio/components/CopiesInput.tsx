'use client';
import { useState } from 'react';
import { MAX_COPIES, sanitizeCopiesInput } from '@/core/tags';
import { cn } from '@/lib/utils/cn';

interface Props {
  /** Normalised value to show when not editing ("1", "20", …). */
  value: string;
  invalid?: boolean;
  label: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  className?: string;
}

/**
 * Copies box. Only digits can be typed, leading zeros are dropped ("011" → "11") and the value
 * is capped at 3 digits (0–999). It is a text field (not type="number"), so the mouse wheel,
 * "e", "-" and "." cannot change it by accident. ↑/↓ step by 1. Empty = 1 copy.
 */
export function CopiesInput({ value, invalid, label, onChange, onFocus, className }: Props) {
  // While the field has focus we show exactly what the person typed (e.g. an empty box);
  // on blur we fall back to the normalised value from the row.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: string) => {
    const clean = sanitizeCopiesInput(next);
    setDraft(clean);
    onChange(clean);
  };

  const step = (delta: number) => {
    const current = Number(draft === null || draft === '' ? value || '1' : draft) || 0;
    commit(String(Math.min(MAX_COPIES, Math.max(0, current + delta))));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={3}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={draft ?? value}
      placeholder="1"
      onFocus={(e) => {
        setDraft(value);
        e.currentTarget.select();
        onFocus?.();
      }}
      onBlur={() => setDraft(null)}
      onChange={(e) => commit(e.target.value)}
      onPaste={(e) => {
        e.preventDefault();
        commit(e.clipboardData.getData('text'));
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          step(e.key === 'ArrowUp' ? 1 : -1);
        } else if (e.key === 'Enter' || e.key === 'Escape') {
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'h-8 w-14 rounded-md border bg-white px-2 text-right text-sm tabular-nums shadow-xs',
        'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none',
        invalid ? 'border-rose-400 text-rose-700' : 'border-slate-300',
        className,
      )}
    />
  );
}
