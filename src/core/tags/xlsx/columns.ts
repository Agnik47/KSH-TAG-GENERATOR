/**
 * The input columns (docs/02) with the help text and colour group used by the Excel template.
 */
export type ColumnGroup = 'required' | 'old' | 'copies';

export interface ColumnSpec {
  header: 'ScanIdentifier' | 'ProductName' | 'Color' | 'Size' | 'MRP' | 'OurPrice' | 'Copies';
  group: ColumnGroup;
  /** Excel column width (characters). */
  width: number;
  /** Excel number format for the data cells. "@" = text (keeps leading zeros in codes). */
  numFmt: string;
  /** One line: what to type. */
  help: string;
  example: string;
}

export const TEMPLATE_COLUMNS: ColumnSpec[] = [
  {
    header: 'ScanIdentifier',
    group: 'required',
    width: 30,
    numFmt: '@',
    help: 'The barcode value, printed exactly as typed. Letters, digits and - only.',
    example: '15-M-PNT-MKI-26-Q20-HYS-11',
  },
  {
    header: 'ProductName',
    group: 'required',
    width: 38,
    numFmt: '@',
    help: 'Shown after "Product :" on the tag. Keep it under about 60 characters.',
    example: "Men's Casual Pants",
  },
  {
    header: 'Color',
    group: 'old',
    width: 14,
    numFmt: '@',
    help: 'Only for old Wishkaro tags. Leave empty for KSH Surplus products.',
    example: 'Red',
  },
  {
    header: 'Size',
    group: 'old',
    width: 14,
    numFmt: '@',
    help: 'Only for old Wishkaro tags, e.g. 0M – 2Y. Printed in bold as typed.',
    example: '0M – 2Y',
  },
  {
    header: 'MRP',
    group: 'required',
    width: 12,
    numFmt: '0.00',
    help: 'Maximum retail price in ₹, more than 0. Printed with 2 decimals and struck through.',
    example: '1190',
  },
  {
    header: 'OurPrice',
    group: 'required',
    width: 12,
    numFmt: '0.00',
    help: 'Selling price in ₹, not more than MRP. Rounded to whole rupees on the tag.',
    example: '595',
  },
  {
    header: 'Copies',
    group: 'copies',
    width: 10,
    numFmt: '0',
    help: 'How many tags to print: 0–999. Empty = 1, 0 = skip this row.',
    example: '2',
  },
];

export const GROUP_LABEL: Record<ColumnGroup, string> = {
  required: 'Required',
  old: 'Old Wishkaro tags only',
  copies: 'Number of tags (empty = 1)',
};
