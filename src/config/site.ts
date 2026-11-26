/** App-wide constants: names, static asset paths and printer facts shown in the UI. */
export const siteConfig = {
  name: 'KSH Tag Studio',
  store: 'Kids Surplus Hub',
  description:
    'Price tags with Code 128 barcodes for the Kids Surplus Hub store (Zebra GX430t; 75 × 125 mm and other label sizes).',
  printer: {
    model: 'Zebra GX430t',
    dpi: 300,
  },
} as const;

/** Files served from /public. */
export const assets = {
  fonts: {
    regular: '/fonts/DejaVuSans.ttf',
    bold: '/fonts/DejaVuSans-Bold.ttf',
  },
  /** 20 example products (18 new KSH Surplus + 2 old Wishkaro). Same as samples/ksh_tags_sample_input.csv. */
  sampleCsv: { url: '/samples/ksh_tags_sample_input.csv', fileName: 'ksh_tags_sample_input.csv' },
  /** Headers only. Same as samples/ksh_tags_template.csv. */
  templateCsv: { url: '/samples/ksh_tags_template.csv', fileName: 'ksh_tags_template.csv' },
  /** Colour-coded Excel versions, generated in the browser from the same data (src/core/tags/xlsx). */
  sampleXlsx: { fileName: 'ksh_tags_sample.xlsx' },
  templateXlsx: { fileName: 'ksh_tags_template.xlsx' },
} as const;

/** Files bigger than this are refused (a 5 MB CSV is ~50,000 rows). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
