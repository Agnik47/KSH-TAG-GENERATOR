# 02 — CSV format

## Input CSV (Phase 1 upload)

UTF-8, comma separated, first row = headers. Header names are case-insensitive; extra columns are ignored (so a Unicommerce-style file with extra columns still loads if it has these headers).

| Column | Required | Example | Rule |
| --- | --- | --- | --- |
| ScanIdentifier | yes | `bt539cfe`, `15-M-PNT-MKI-26-Q20-HYS-11` | The barcode value, printed **exactly** as given (trim spaces only). Printable ASCII only (Code 128). |
| ProductName | yes | `Men's Casual Pants` | Shown on the "Product :" line. Max ~60 characters; font shrinks to fit. |
| Color | no | `Red` | Old Wishkaro products only. If Color **or** Size is filled → "old" layout; if both empty → "new" layout. |
| Size | no | `0M – 2Y` | Size range text, printed as given (bold). |
| MRP | yes | `1190` | Number > 0. Printed with 2 decimals, struck through (₹1190.00). |
| OurPrice | yes | `595` | Number > 0 and ≤ MRP. Rounded to whole rupees (half up) and printed without decimals (₹595). |
| Copies | no | `20` | Whole number 0–999. Empty = 1. 0 = skip row. |

Also accept these header aliases so files from other tools load: `Barcode`, `SKU`, `Code` → ScanIdentifier; `Name`, `Title` → ProductName; `Colour` → Color; `SellingPrice`, `Price`, `SP` → OurPrice; `Qty`, `Quantity` → Copies.

Duplicate rows: allowed. If the file is "one row per label" (no Copies column, same code repeated), each row = 1 tag — this matches the Unicommerce export.

Derived values (computed by the app, never typed):

- `YouSave = MRP − round(OurPrice)` (whole rupees)
- `SkuLine`: new layout → `SKU : <ScanIdentifier>`; old layout → `SKU : <ScanIdentifier>  |  Color : <Color>  |  Size : ` followed by Size in bold.

Validation errors (row not printed):

| Error | When |
| --- | --- |
| Missing barcode | ScanIdentifier empty |
| Invalid barcode characters | Not printable ASCII |
| Barcode too long | Does not fit 113 mm even at the thinnest bar (see 03_TAG_DESIGN) |
| Missing name | ProductName empty |
| Bad MRP / Bad price | Not a positive number |
| Price above MRP | OurPrice > MRP |
| Bad copies | Not a whole number 0–999 |

See `samples/ksh_tags_template.csv` and `samples/ksh_tags_sample_input.csv`.

## Output CSV (Phase 2 export)

One row per label (like Unicommerce), so it also works with label software (BarTender etc.) if ever needed.

Columns: `ScanIdentifier, ProductName, Color, Size, MRP, OurPrice, YouSave, SkuLine`

Example: `samples/ksh_tags_sample_expanded_output.csv`.
File name: `ksh-tags_<YYYY-MM-DD_HHmm>_<total labels>.csv`.

Phase 1 must also be able to export this expanded CSV from an uploaded input CSV (same function Phase 2 will reuse).
