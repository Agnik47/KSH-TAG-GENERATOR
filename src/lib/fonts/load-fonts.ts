import { assets } from '@/config/site';
import { createFontMetrics, type FontBytes, type FontMetrics } from '@/core/tags';

export interface LoadedFonts {
  fonts: FontBytes;
  metrics: FontMetrics;
}

let pending: Promise<LoadedFonts> | null = null;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Load DejaVu Sans + Bold from /public/fonts once per page load (browser only). */
export function loadFonts(): Promise<LoadedFonts> {
  pending ??= Promise.all([fetchBytes(assets.fonts.regular), fetchBytes(assets.fonts.bold)])
    .then(([regular, bold]) => {
      const fonts = { regular, bold };
      return { fonts, metrics: createFontMetrics(fonts) };
    })
    .catch((e: unknown) => {
      pending = null; // allow a retry
      throw e;
    });
  return pending;
}
