/**
 * Excel (.xlsx) support: the colour-coded template/sample and reading a filled workbook.
 * Kept out of `@/core/tags` (index.ts) on purpose: ExcelJS is large, so the browser loads
 * this module only when someone downloads a template or opens an .xlsx file:
 *   const xlsx = await import('@/core/tags/xlsx');
 */
export * from './columns';
export * from './template';
export * from './read';
