'use client';
import { useCallback, useEffect, useState } from 'react';
import { loadFonts, type LoadedFonts } from '@/lib/fonts/load-fonts';

export interface TagFontsState {
  fonts: LoadedFonts | null;
  error: string | null;
  retry: () => void;
}

/** Load the DejaVu fonts (needed for measuring, preview and PDFs) once. */
export function useTagFonts(): TagFontsState {
  const [fonts, setFonts] = useState<LoadedFonts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadFonts().then(
      (f) => alive && setFonts(f),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { fonts, error, retry };
}
