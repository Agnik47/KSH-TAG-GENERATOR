# KSH Tag Studio

Price-tag + barcode generator for the **Kids Surplus Hub (KSH)** offline store.

**Phase 1 (built):** drop a CSV → check the table and live preview → download a print-ready PDF for the Zebra GX430t (300 dpi, 75 × 125 mm roll). It runs entirely in the browser: no login, no server, no secrets, nothing is uploaded.

## Run it

Requires Node.js 20.9+ (`.nvmrc` pins 22; built and tested with Node 26).

```bash
npm install          # once
npm run dev          # http://localhost:3000 (development)
npm run check        # typecheck + lint + format check + tests (run before every deploy)
npm run build        # static site in out/
npx serve out        # serve the built site locally (or: python -m http.server -d out)
```

Other scripts: `npm test`, `npm run test:watch`, `npm run lint` / `lint:fix`, `npm run format`, `npm run typecheck`.

## Deploy

`npm run build` writes a fully static site to `out/`. Host it anywhere:

- **Vercel**: import the project; framework = Next.js. No env vars are needed in Phase 1. Note: the Hobby plan is not for commercial use (see docs/05 D8).
- **Netlify / Cloudflare Pages**: build command `npm run build`, publish directory `out`.
- **Any web server / shared drive**: copy the contents of `out/`. It must be served over http(s) at the site root, because the fonts load from `/fonts/…`.

## Using it in the store

1. Click **Sample Excel** in the top bar (20 example products) or **Template** (empty). Fill one row per product on the **Tags** sheet: green columns are required, blue ones (Color, Size) only for old Wishkaro tags, amber is Copies. A red cell means a mistake. The **How to fill** sheet explains every column. (CSV versions are still available on the start screen.)
2. Click **Open file** or drop the Excel (.xlsx) or CSV file anywhere on the page. Each row shows **Ready**, **Skipped** (Copies 0) or **Error** with the reason; **Row** is the row number in your file. Error rows are never printed. The **Errors** filter shows only the problems.
3. Click a row (or use ↑ ↓) to see its tag on the right. Change **Copies** in the table, or use **Set all copies**.
4. **Test print (1 each)** → print → scan each tag at the POS.
5. **Download print PDF** → print on the Zebra at **Actual size / 100%** (never "Fit to page"), paper 75 × 125 mm, portrait.

## Code layout

```
src/
  app/                       Next.js routes only: layout, page, error, not-found, icon, globals.css
  config/site.ts             App name, printer facts, static asset paths, limits
  core/tags/                 The tag pipeline. Framework-free (lint-enforced); Phase 2 reuses it on the server
    csv/                     parse (headers + aliases) · validate (rules, derived values, Copies) · expand (one row per label)
    barcode/code128.ts       Code 128 via bwip-js; bars 7/6/5/4/3 dots within 113 mm incl. quiet zones
    layout/                  tag-layout (tag → drawing instructions, mm) · font-metrics (DejaVu widths, missing glyphs)
    pdf/render-pdf.ts        Print (75 × 125, rotated 90°) and preview (125 × 75) PDFs; one Form XObject per distinct tag
    xlsx/                    Colour-coded Excel template/sample (ExcelJS) and .xlsx reading. Lazy-loaded, not in index.ts
    index.ts                 Public API
  features/tag-studio/       The Tag Studio screen
    components/              TagStudio, RowsToolbar, RowsTable, CopiesInput, PreviewPanel, TagPreview, ActionsPanel, PrintGuide, EmptyState
    hooks/                   useTagStudio (state + commands), useTagFonts
    state/studio-reducer.ts  Pure reducer (unit-tested)
  components/                Shared UI: layout/AppHeader (navbar), ui/Button, Badge, Toaster
  lib/                       Browser helpers: download, read-tag-file (CSV/Excel, file checks, encoding), load-fonts, utils/cn
public/                      fonts/ (DejaVu + licence), samples/ (sample + template CSV)
tests/                       core/ (pipeline), features/ (reducer), helpers/
docs/                        Spec (01–05) and DECISIONS_LOG.md
```

## Build pack (spec)

| File | What it is |
| --- | --- |
| `PROMPT.md` | The prompts for Claude Code (Phase 1, then Phase 2) |
| `docs/01_PRODUCT_SPEC.md` | Who uses it, the workflows, what each phase must do |
| `docs/02_CSV_FORMAT.md` | The CSV the app reads (Phase 1) and writes (Phase 2) |
| `docs/03_TAG_DESIGN.md` | The exact KSH tag style: sizes, positions, fonts, barcode rules |
| `docs/04_SHOPIFY_DATA.md` | Phase 2 only: where every value comes from in Shopify, IDs, rules |
| `docs/05_DECISIONS.md` | Decisions already made, and open questions |
| `samples/` | CSV template, 20-product sample input, sample expanded output |
| `reference/` | The Python scripts and PNGs of the tags already printed and scanned in the store (layout source of truth) |

## The two phases

- **Phase 1 – Semi-automatic (done):** upload a CSV → preview → print-ready PDF.
- **Phase 2 – Automatic (next):** staff search a SKU, type the quantity, click OK → the app fills name, prices, colour and size from Shopify → downloads the CSV and/or the print PDF. See Prompt 2 in `PROMPT.md`.
