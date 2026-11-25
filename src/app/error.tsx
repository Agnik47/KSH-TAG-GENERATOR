'use client';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Shown if something unexpected breaks while rendering. Data never leaves the browser. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
        <TriangleAlert className="mx-auto size-8 text-rose-600" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-slate-600">{error.message || 'An unexpected error occurred.'}</p>
        <Button className="mt-4" variant="primary" icon={<RotateCcw className="size-4" />} onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
