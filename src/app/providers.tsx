'use client';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/Toaster';

/** Client-side providers shared by every page. */
export function Providers({ children }: { children: ReactNode }) {
  return <Toaster>{children}</Toaster>;
}
