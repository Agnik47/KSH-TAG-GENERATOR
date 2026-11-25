# 03 — Tag design (KSH custom style)

The design below is copied from `reference/old_sku_tag_reference.py` and `reference/new_sku_tag_reference.py`. Tags made with those scripts were printed on the store's Zebra and scanned successfully. **Match them.** Visual targets: `reference/tag_example_old_sku.png`, `reference/tag_example_new_sku.png`.

## Canvas

- Design is **landscape 125 mm wide × 75 mm tall**.
- The roll is 75 mm wide × 125 mm long, so the **print PDF** page is 75 × 125 mm (portrait) with the design rotated 90°: translate x by 75 mm, then rotate +90°.
- Also produce a **preview PDF** (pages 125 × 75 mm, not rotated) for checking on screen.
- One page per tag copy.

## Fonts

- R = DejaVu Sans, B = DejaVu Sans Bold (TTF embedded — needed for the ₹ sign; standard PDF fonts cannot draw it). Free license; bundle the TTF files in the app.
- Sizes are in points (pt). Colours: black, except the MRP value in 35% grey.

## Layout (all positions in mm from the BOTTOM-LEFT of the 125 × 75 design; left margin p = 6)

| Element | x | y (baseline) | Font | Notes |
| --- | --- | --- | --- | --- |
| `KIDS SURPLUS HUB` | 6 | 69 | B 8 | |
| `Product : <ProductName>` | 6 | 63.5 (old) / 63 (new) | R 9 (old) / R 10 (new) | If wider than 113 mm, reduce size by 0.5 pt until it fits, minimum 6 pt |
| SKU line | 6 | 58 (old) / 57.5 (new) | R 9 | Old: `SKU : code  \|  Color : X  \|  Size : ` then the size text in **B 11** right after it. New: `SKU : code` |
| `MAXIMUM RETAIL PRICE` | 6 | 50 | B 8.5 | |
| MRP value `₹1190.00` | 6 | 42 | R 16, grey 35% | Strike line 1.2 pt, black, from x−0.35 mm to end+0.35 mm, 2.4 mm above the baseline |
| `(Inclusive of all Taxes)` | 6 | 37.5 | R 6.5 | |
| `OUR PRICE` | 66.5 | 50 | B 8.5 | (125/2 + 4) |
| Our price `₹595` | 66.5 | 40.5 | B 26 | No decimals |
| `You save ₹595` | 66.5 | 37 | R 7.5 | |
| Barcode | centred horizontally | bottom edge at 22, height 12 | — | Code 128, no human-readable text from the barcode library |
| Code text under barcode | centred | 17.5 | B 9 | The ScanIdentifier |
| Divider line | 6 → 119 | 15 | 0.4 pt | |
| Footer line 1 | centred | 11.5 | R 5.6 | Old: `Marketed by: Kotemoda Lifestyle Pvt. Ltd.  \|  Country of Origin: India  \|  Net Qty: 1 N`  New: `Marketed by: Kotemoda Lifestyle Pvt. Ltd.  \|  Net Qty: 1 N` |
| Footer line 2 | centred | 8 | R 5.6 | `Customer care: 9972769817  \|  care@wishkaro.com` |

"Old" = Color or Size filled; "New" = both empty (see 02_CSV_FORMAT).

## Barcode rules

- Symbology: Code 128 (auto code set). Value = ScanIdentifier exactly.
- Printer is 300 dpi → 1 dot = 0.0847 mm. Narrow bar (module) width must be a whole number of dots.
- Choose the widest module from **7, 6, 5, 4, 3 dots** (0.593, 0.508, 0.423, 0.339, 0.254 mm) for which barcode width + quiet zones (10 modules each side) ≤ **113 mm**.
- Never thinner than 3 dots (0.254 mm). If it still does not fit → row error "Barcode too long".
- Height 12 mm. Black bars on white, no border.
- Expected: short old codes (`bt539cfe`) → 7 dots; new codes like `1-MS-VC-26-Q56-WOS-11` → 4 dots (≈90 mm); `15-M-PNT-MKI-26-Q20-HYS-11` → 3 dots (≈82 mm).

## Rendering checks (tests)

- Print PDF page size = 75 × 125 mm (212.6 × 354.3 pt) ± 0.1.
- Preview PDF page size = 125 × 75 mm.
- Number of pages = sum of copies.
- Barcode decodes back to the same ScanIdentifier (decode the rendered barcode in a test, e.g. render to PNG and read with zxing / a JS decoder).
- The ₹ glyph renders (font embedded).

## Printing instructions (show in the app)

Print the PDF on the Zebra GX430t with **Actual size / 100%** (never "Fit to page"), paper 75 × 125 mm, portrait.
