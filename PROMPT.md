# Prompts for Claude Code

How to use:

1. Unzip this folder. Open a terminal **inside** it and start Claude Code.
2. (Recommended) Add the Shopify Dev MCP so Claude Code can check the Shopify schema: `claude mcp add shopify-dev -- npx -y @shopify/dev-mcp@latest`
3. Paste **Prompt 1**. Test Phase 1 in the store. Only then paste **Prompt 2**.

---

## Prompt 1 — Phase 1: CSV → KSH tags (no Shopify)

```text
You are building "KSH Tag Studio", an internal tool for the Kids Surplus Hub offline store (Kotemoda Lifestyle Pvt. Ltd.). It turns a CSV into print-ready price tags with Code 128 barcodes for a Zebra GX430t (300 dpi, 75 x 125 mm roll).

Before writing any code, read every file in this folder: README.md, docs/01_PRODUCT_SPEC.md, docs/02_CSV_FORMAT.md, docs/03_TAG_DESIGN.md, docs/05_DECISIONS.md, the samples/ CSVs, and reference/ (two Python scripts and two PNG tags). The Python scripts produced tags that were printed in the store and scanned correctly: your output must match them. docs/04_SHOPIFY_DATA.md is for Phase 2 only; do not build Shopify features now.

Build Phase 1 only:
- Next.js (App Router) + TypeScript + Tailwind, in this folder (keep docs/, samples/, reference/ as they are). Phase 1 runs fully in the browser: no API routes, no database, no login, no secrets, nothing uploaded.
- Libraries: papaparse (CSV), bwip-js (Code 128), pdf-lib + @pdf-lib/fontkit (PDF), DejaVu Sans + DejaVu Sans Bold TTF bundled in /public/fonts (they are needed for the rupee sign), Vitest for tests.
- Page: drop/choose CSV -> validated table (ScanIdentifier, ProductName, Color, Size, MRP, OurPrice, You save, Copies editable, Status) -> live preview of the selected tag -> buttons: "Test print (1 each)", "Download print PDF", "Download preview PDF", "Export expanded CSV", "Download CSV template". Show the printing instruction from docs/03 on the page.
- Keep the code split so Phase 2 can reuse it: lib/csv (parse + validate + expand), lib/tag (layout model: pure function from a row to drawing instructions), lib/pdf (render print + preview PDFs), lib/barcode (module-width choice + bwip-js). UI only calls these.

Exact rules: CSV columns, aliases, validation and derived values from docs/02. Layout, fonts, positions, barcode module rule (7/6/5/4/3 dots, max 113 mm with quiet zones), page sizes and the 90-degree rotation from docs/03. Rows with errors are shown with the reason and never printed. ScanIdentifier is printed exactly as given.

Tests (must pass): CSV parsing incl. aliases, Copies empty=1 and 0=skip, one-row-per-label files; validation errors; price rounding and You save; old vs new layout choice; barcode module choice for "bt539cfe" (7 dots), "1-MS-VC-26-Q56-WOS-11" (4 dots), "15-M-PNT-MKI-26-Q20-HYS-11" (3 dots); print PDF page size 75x125 mm and preview 125x75 mm; page count = total copies; the rendered barcode decodes back to the same value (render to PNG and decode in the test).

Acceptance: load samples/ksh_tags_sample_input.csv -> 20 Ready rows, Test print gives 20 pages that look like reference/tag_example_*.png; "Export expanded CSV" matches the format of samples/ksh_tags_sample_expanded_output.csv.

If something is not specified, choose the simplest option, write it in docs/DECISIONS_LOG.md, and continue. Do not stop to ask unless you are truly blocked. When done: give me the commands to run it locally and to deploy it (Vercel or any static host), and a short list of what you decided.
```

---

## Prompt 2 — Phase 2: search SKU + quantity → CSV + tags (Shopify)

Before pasting: create the Shopify **Dev Dashboard app** (scopes `read_products`, `read_inventory`, `read_locations`), install it on the store, and have its **client ID and secret** ready. Have a Postgres URL ready (Neon or Supabase free tier).

```text
Phase 1 of KSH Tag Studio is built and in use. Now build Phase 2 on top of it, without changing the tag output.

Read again: docs/01_PRODUCT_SPEC.md (Phase 2 section), docs/04_SHOPIFY_DATA.md (all of it), docs/05_DECISIONS.md, docs/DECISIONS_LOG.md. Use the Shopify Dev MCP to check every GraphQL field and filter before using it; never guess fields.

Build:
- Server-side Shopify client: Dev Dashboard app with the client-credentials grant, token cached and refreshed. Env: SHOPIFY_STORE_DOMAIN, SHOPIFY_API_VERSION=2026-10, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, KSH_LOCATION_ID, KSH_PRICE_LIST_ID (values in docs/04). Read-only: no mutations anywhere. Also a mock client with fixtures for bt539cfe and 15-M-PNT-MKI-26-Q20-HYS-11 (USE_MOCK_SHOPIFY=true) so everything runs without credentials.
- A resolver that turns a scanned/typed code or title search into the same row type Phase 1 uses (ScanIdentifier, ProductName, Color, Size, MRP, OurPrice), following the family rules in docs/04 exactly (old = one tag per colour with highest KSH price and size range; new = KSH Surplus single variant). Missing KSH price / MRP / barcode = Blocked with reason. Unit-test every rule.
- Login: username + PIN (bcrypt), roles admin/staff, signed session cookie, 5 failed tries = 15 min lock. Prisma + Postgres tables: users, print_jobs, print_job_items. Seed one admin from ADMIN_USERNAME / ADMIN_PIN.
- Page "Search & print": search box that accepts barcode-scanner input (code + Enter), SKU or title words; results added to a list with an empty Quantity field (required, 1-999; stock shown as info only). Button "OK / Generate": the server re-reads Shopify, validates, saves the print log, and returns the expanded CSV (one row per label) and the print PDF using the Phase 1 renderer. Phase 1 "Upload CSV" page stays available.
- Admin pages: users (add, disable, reset PIN) and print history. /api/health shows whether Shopify, the location and the price list are reachable.

Acceptance: with live credentials, searching 15-M-PNT-MKI-26-Q20-HYS-11 fills Men's pant data with OurPrice 595 and MRP 1190; quantity 2 -> CSV with 2 rows and a 2-page PDF identical to Phase 1 output; bt539cfe shows Color Red, Size 0M - 2Y, OurPrice 282 and Blocked "No MRP" (until MRP is added in Shopify). Update the README with setup steps (Dev Dashboard app, scopes, env vars, database, deploy). Log any decision in docs/DECISIONS_LOG.md.
```
