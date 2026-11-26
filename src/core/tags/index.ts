/**
 * Public API of the tag pipeline: CSV → validated rows → tag layout → PDF.
 * Framework-free (no React / DOM / Next.js). Used by the Phase 1 UI and, later,
 * by the Phase 2 server routes, so tags are always produced by the same code.
 */
export * from './types';
export * from './csv/parse';
export * from './csv/validate';
export * from './csv/expand';
export * from './barcode/code128';
export * from './barcode/qr';
export * from './label/label';
export * from './layout/tag-layout';
export * from './layout/font-metrics';
export * from './pdf/render-pdf';
