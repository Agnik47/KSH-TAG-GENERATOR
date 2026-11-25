import type { ReactNode } from 'react';
import { Tag } from 'lucide-react';
import { siteConfig } from '@/config/site';

/** Top navigation bar. Page-specific buttons go in `actions`. */
export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm">
            <Tag className="size-4.5" aria-hidden />
          </span>
          {/* On phones only the logo shows; the action buttons need the room. */}
          <div className="sr-only min-w-0 leading-tight sm:not-sr-only">
            <p className="truncate text-[15px] font-semibold text-slate-900">{siteConfig.name}</p>
            <p className="hidden truncate text-xs text-slate-500 sm:block">
              {siteConfig.store} · price tags for {siteConfig.printer.model} ({siteConfig.printer.paper})
            </p>
          </div>
        </div>
        <nav aria-label="Main actions" className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {actions}
        </nav>
      </div>
    </header>
  );
}
