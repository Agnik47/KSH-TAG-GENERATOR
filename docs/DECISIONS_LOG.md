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
