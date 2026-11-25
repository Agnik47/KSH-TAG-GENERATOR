import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type BadgeTone = 'success' | 'danger' | 'neutral' | 'warning' | 'info';

const TONES: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  info: 'bg-sky-50 text-sky-800 ring-sky-600/20',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
