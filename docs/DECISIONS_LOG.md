# Decisions log

These are choices made while building, where the docs (01–05) did not say what to do. Newest at the bottom of each phase.

## Phase 1 (CSV → tags), 25 Nov 2026

| # | Decision | Why |
| --- | --- | --- |
| P1-1 | **Static export** (`output: 'export'`). `next build` writes a plain static site to `out/`. | Phase 1 has no server code. It can run on Vercel, Netlify, Cloudflare Pages or any file server. Phase 2 removes this line when it adds API routes. |
| P1-2 | **Barcode bars are drawn as vector rectangles** from bwip-js `raw()` (the bar/space widths in modules). The barcode is not drawn as a raster image. | Every bar is an exact whole number of printer dots (module = 7/6/5/4/3 × 25.4/300 mm). The PDF stays sharp at any zoom. |
| P1-3 | The barcode's **left edge is rounded to a whole printer dot** (≤ 0.042 mm shift from exact centring). | On the 300 dpi Zebra, every bar edge then lands on the dot grid, so bars do not gain or lose a dot. |
| P1-4 | `bwip-js/browser` entry is imported everywhere (browser and Node tests). | The package's main export map only lists `browser`/`node` conditions, which TypeScript "bundler" resolution cannot see. The browser build is pure JS, so tests and the app run the same encoder. |
| P1-5 | **Fonts are embedded whole** (`subset: false`), about 0.8 MB once per PDF. | pdf-lib's font subsetter has known glyph-mapping bugs with some TTFs; the ₹ sign must never break. |
| P1-6 | Text widths come from the font's glyph advance widths, with no kerning. This is the same method pdf-lib and ReportLab use. | Centring, the shrink-to-fit product name and the bold Size after the SKU line all match the reference scripts. |
| P1-7 | **Product name shrink-to-fit applies to both layouts** (old starts at 9 pt, new at 10 pt; −0.5 pt steps, minimum 6 pt). | docs/03 states the rule for the "Product" line without limiting it to old tags. The new reference script had no long names. |
| P1-8 | A **SKU line wider than 113 mm** is a *warning* (shown in the table), not an error; it is not shrunk. | docs/03 gives no rule for it. The tag still scans and prints, and real codes fit. |
| P1-9 | **Strike-through on MRP** runs from x − 1 pt to the text end + 1 pt (≈ 0.35 mm), as in the scripts. It is black and 1.2 pt; the MRP text itself is 35 % grey. | Matches the reference scripts exactly (docs/03 gives the same in mm). |
| P1-10 | **Price parsing** accepts `₹`, `Rs`, `INR`, thousands commas and spaces (`₹1,190.00` → 1190). It rejects anything else (e.g. `1e3`, negative). | CSVs exported from Excel often add these. |
| P1-11 | **"Price above MRP"** compares the typed OurPrice with MRP (before rounding). | Literal reading of docs/02. |
| P1-12 | **YouSave** = MRP − round(OurPrice), rounded half up to whole rupees and **never below 0**. This only matters for odd inputs like MRP 99.5 / price 99.5. | A tag must never say "You save ₹-1". |
| P1-13 | **Copies** in a file also accepts `2.0` and leading zeros (`011` = 11, shown as 11). Empty or no Copies column = 1; `0` = row shown as *Skipped* and not printed. | Excel sometimes writes whole numbers as `2.0`; the table always shows the clean number. |
| P1-14 | **Header matching**: canonical names win over aliases if both exist (e.g. `SKU` and `ScanIdentifier` both present → ScanIdentifier is used). A missing required column is a file-level error. | Unicommerce exports have both a SKU and a ScanIdentifier column; the barcode must be ScanIdentifier. |
| P1-15 | **Expanded CSV** is UTF-8 without BOM, CRLF line endings, with a trailing newline, and quotes only where needed. It is byte-identical to `samples/ksh_tags_sample_expanded_output.csv` (tested). MRP is written as typed (`1190`, `998.5`); OurPrice/YouSave are whole rupees. | Matches the sample file. |
| P1-16 | **Preview PDF** has one page per product (not per copy), like the reference scripts. The print PDF has one page per copy; Test print has one page per product. | The preview PDF is for checking on screen; 999 copies of the same preview page are not useful. |
| P1-17 | PDF file names: `ksh-tags_print_<YYYY-MM-DD_HHmm>_<pages>.pdf`, `ksh-tags_TEST-1-each_…`, `ksh-tags_preview_…`. | Same pattern as the expanded CSV name in docs/02. |
| P1-18 | The **live preview is an SVG** drawn from the same drawing instructions as the PDF. It uses the same DejaVu fonts via `@font-face`, and each text's width is fixed to the measured width. | No PDF viewer is needed in the page, and the preview updates instantly. |
| P1-19 | A **"Try with the sample CSV"** button loads `public/samples/ksh_tags_sample_input.csv` (a copy of the sample). | Staff training and quick checks without hunting for a file. |
| P1-20 | Offline use (nice-to-have) is **not** built yet (no service worker). Once the page is open it needs no network. | Kept Phase 1 simple; can be added with a small service worker if the store's internet is unreliable. |
| P1-21 | TypeScript is pinned to 6.0.x (not 7.x). | TS 7 (native port) does not ship the JS API that `next build` uses for type-checking. |

## Phase 1.1 (fixes, UI/UX, structure), 25 Nov 2026

| # | Decision | Why |
| --- | --- | --- |
| P1-22 | **Copies box is a text field that only takes digits**: leading zeros are removed as you type (`011` → `11`, `0111` → `111`), max 3 digits (0–999), paste is cleaned the same way, ↑/↓ step by 1. It is not `type="number"`. | Bug fix: `011`/`0111` were accepted and shown as typed. `type="number"` also lets `e`, `-`, `.` in and changes the value when the mouse wheel scrolls over it. |
| P1-23 | **Each distinct tag is drawn once as a PDF Form XObject**; every copy's page only places it. | 2,000 labels went from ~19 s to ~2.3 s and from 4.1 MB to 1.2 MB, without freezing the page. Output is identical (verified by rendering and decoding all 20 sample barcodes from the print PDF). |
| P1-24 | **Excel files (.xlsx etc.) are refused** with a "Save As CSV UTF-8" hint; CSVs over 5 MB are refused. | Clear message instead of "Missing column" errors from binary data. |
| P1-25 | **Non-UTF-8 CSVs are read as Windows-1252** (Excel's plain "CSV (Comma delimited)"), with a notice. | Otherwise "0M – 2Y" would become "0M � 2Y" and print wrong. |
| P1-26 | **Characters the font cannot draw** (e.g. Hindi) produce a warning on the row and in the preview. | They would print as empty boxes. It is a warning, not an error, because the rest of the tag (and barcode) is fine. |
| P1-27 | UI: navbar on top (Open CSV, Sample CSV, Template, Try sample); below it the **table (left) and preview + print actions (right) scroll independently** on screens ≥ 1024 px; on phones they stack. Filters (All/Ready/Errors/Skipped), **Set all copies**, Replace/Clear, ↑/↓ row navigation, drop a CSV anywhere, toasts for downloads and errors. | Staff asked for a fixed sidebar with its own scroll and a navbar; filters and bulk copies make long files practical. |
| P1-28 | **"Sample CSV" download** gives the 20-product sample (`public/samples/ksh_tags_sample_input.csv`) to fill in; "Template" gives headers only. | Owner request: fill the sample CSV with real data for now. |
| P1-29 | **Folder structure**: `src/core/tags` (framework-free tag pipeline, lint-enforced: no React/Next/UI imports), `src/features/tag-studio` (components, hooks, pure reducer), `src/components` (layout + UI primitives), `src/lib` (browser helpers), `src/config`. Tests mirror it in `tests/`. | Phase 2 server code can import `src/core/tags` directly; UI state is a pure, unit-tested reducer. |
| P1-30 | Tooling: ESLint (next core-web-vitals + TypeScript), Prettier (+ Tailwind class sorting), `.editorconfig`, `.nvmrc` (Node 22), GitHub Actions CI, and `npm run check` (typecheck + lint + format + tests). The Next dev badge is hidden (`devIndicators: false`). | Consistent code and a single command before every deploy. The dev badge covered the drop zone. |

## Phase 1.2 (Excel template), 25 Nov 2026

| # | Decision | Why |
| --- | --- | --- |
| P1-31 | **Colour-coded Excel template and sample** (`ksh_tags_template.xlsx`, `ksh_tags_sample.xlsx`), made in the browser with ExcelJS from `src/core/tags/xlsx`. Sheet **Tags**: title (row 1), colour legend (row 2), header (row 3), data from row 4. Header colours: **green = required** (ScanIdentifier, ProductName, MRP, OurPrice), **blue = old Wishkaro tags only** (Color, Size), **amber = Copies**; data columns are lightly tinted the same way. Sheet **How to fill**: what to type in each column plus the steps. | Owner asked for a better-looking, colour-coded template. A CSV cannot hold colours, so the template is Excel. |
| P1-32 | The template **checks while typing**: number checks (data validation: prices > 0, Copies whole 0–999, barcode ≤ 40 characters) with prompts; and **red highlighting** (conditional formatting) for a missing barcode or name, a missing or non-numeric price, price above MRP and bad Copies. ScanIdentifier/Color/Size cells are Text format so leading zeros in codes survive. Frozen header and filter buttons. | Mistakes are caught in Excel, before the file reaches the app. |
| P1-33 | **The app opens .xlsx directly** (sheet "Tags", else the first sheet); CSV still works. .xls/.xlsm/.ods are refused with a "Save As .xlsx or CSV UTF-8" message. Numbers, formulas (their result), rich text and hyperlinks are read as the text a person sees. | Staff can fill the Excel template and load it without "Save As CSV". |
| P1-34 | **The header row is found automatically** in the first 10 rows (a row naming the barcode column and one more known column), for CSV and Excel. | Lets the styled template have a title and legend above the header. |
| P1-35 | The table's first column is now **Row = row number in the uploaded file** (Excel row / CSV line). | "Row 6: Price above MRP" points straight at row 6 in Excel. |
| P1-36 | **ExcelJS is loaded only when needed** (download a template or open an .xlsx): separate ~0.9 MB chunk, not in the first page load. `uuid` is overridden to ^11.1.1 (ExcelJS's pinned version had a moderate advisory; ExcelJS only calls `v4()`, which is unchanged). | Fast first load; `npm audit` clean. |

## Phase 1.3 (label sizes), 25 Nov 2026

| # | Decision | Why |
| --- | --- | --- |
| P1-37 | **Label size choice** in the right panel: 75 × 125 mm (default, the current roll), 100 × 50 mm, 51 × 32 mm, or a custom size (20–104 mm across, the GX430t's print width; up to 300 mm long). Sizes are written like Zebra rolls: **width across the printer × length**. The last choice is remembered in the browser. | Owner wants 1–3 sizes, incl. a small 51 × 32 tag, chosen before printing. |
| P1-38 | **Horizontal / Vertical** for every size. Horizontal = the long side reads left to right; vertical = the tag stands upright. The print PDF page is always the label as it leaves the printer; when the tag and the label disagree the tag is turned 90° on the page (the same rule docs/03 uses for 125 × 75 on the 75 × 125 roll). The barcode always runs across the tag. | Owner chose "tag can be portrait". One rule covers every size and keeps the default unchanged. |
| P1-39 | **The barcode is checked per label.** Room = tag width − both side margins (113 mm on the standard tag); the widest 7…3-dot module that fits is used; never thinner than 3 dots (0.25 mm). Codes that do not fit become row errors, e.g. "Barcode too long for 51 × 32 mm (needs 87 mm, fits 46 mm)". Changing the size re-checks every row (ids and Copies kept). | The KSH SKU codes need 73–87 mm even at the thinnest bars, so they cannot go on small labels. Better an error before printing than an unscannable tag. |
| P1-40 | **Layouts**: 75 × 125 horizontal keeps the exact docs/03 tag. Other sizes with a short side ≥ 40 mm show the same content, with text sized down together until the barcode is at least 8 mm tall (grown up to 1.4× on roomy tags while the barcode keeps 12 mm); the footer wraps at " \| " on narrow tags; the store name and "You save" are dropped only as a last resort (with a warning). **Small tags (short side < 40 mm, e.g. 51 × 32): product name, barcode and code only, no footer** (owner's choice); long names are shortened with "…". | Readable tags on every size without hand-drawing each one. |
| P1-41 | PDF file names include the size for non-standard labels (`ksh-tags_print_51x32mm_…pdf`, `…-vertical`). The print guide shows the chosen paper size and says to set it in the Zebra settings and calibrate after changing rolls. | Avoids printing a 51 × 32 PDF on the 75 × 125 roll by mistake. |

## Phase 1.4 (QR tag for small labels), 25 Nov 2026

| # | Decision | Why |
| --- | --- | --- |
| P1-42 | **Small labels (short side < 40 mm, e.g. 51 × 32) print a QR code instead of a line barcode**, for old and new SKUs alike. The QR holds only the ScanIdentifier (error correction M), so Shopify POS matches it to the product's Barcode field as before. Squares are whole printer dots, aiming at ~12.5 mm (6 dots = 0.51 mm for the 25 × 25 new-SKU QR, 7 dots for the 21 × 21 old-SKU QR), never under 5 dots (0.42 mm); ≥ 4 squares of white all round. Every current code fits 51 × 32 in both directions. | The new SKU codes need 73–87 mm as a line barcode, more than a 51 mm label. A phone-camera test of the QR tags scanned. |
| P1-43 | **Design "Classic"** (owner's choice from `docs/TEST_CODE/QR_Design_*.pdf`): KIDS SURPLUS HUB (letter-spaced) and a thin rule, product name, QR left, prices right, code centred at the bottom; portrait tags stack the QR above the prices. Owner's changes: **"MRP" → "PRICE"** (struck through) and **no "(Incl. of all taxes)" line**. Black only (thermal printers dither grey). | Agreed design; same look for old and new SKUs. |
| P1-44 | 75 × 125 (docs/03) and other line-barcode sizes are unchanged. | Those tags are in use and scan; only small labels needed the QR. |

## Phase 1.5 (QR tag with MRP and legal details), 26 Nov 2026

| # | Decision | Why |
| --- | --- | --- |
| P1-45 | **Small QR tag, owner's new design** (sample: `docs/TEST_CODE/KSH_QR_51x32_MRP_SAMPLE.pdf`, `node scripts/make-qr-mrp-sample.mjs`): "PRICE" → **"MRP ₹1190.00"** (still struck through) with **"(Incl. of all taxes)"** under it; **"You save" removed** and replaced by **"Mfd: Nov-26"** (small, regular weight); new bottom line **"Mfg/Mkt: K.L. Pvt. Ltd. Bengaluru-67 | Country of Origin: INDIA"** (two lines on vertical tags). The QR code is unchanged (same squares and size). Old SKUs with a Size line use a slightly smaller big price (12 pt, 11 pt vertical) so nothing crowds. | Owner wants the legal details of the old Wishkaro label on the QR tag without changing the QR that already scans. |
| P1-46 | **Mfd = the month the PDF/preview is made** (computer's local date), written `Mon-YY`. `layoutTag(…, date)` takes the date so tests are fixed. | Owner's example "Mfd: Nov-26" on 26 Nov 2026. Tags printed in a new month show that month. |
| P1-47 | "Bengaluru-67" spelt as on the old Wishkaro label. The 75 × 125 and other line-barcode tags are unchanged. | Same text as the label already in use; only the small QR tag was redesigned. |

