# 01 — Product spec

## Business context

- Business: Kids Surplus Hub (KSH), an offline store of Kotemoda Lifestyle Pvt. Ltd. (brands Wishkaro / Pattumart).
- Billing: Shopify POS at location "Kids Surplus Hub". Staff scan the barcode on the tag; POS finds the product by its barcode.
- Stock: EasyEcom is the stock master and syncs to Shopify automatically. This app never changes stock.
- Printer: Zebra GX430t, 300 dpi, label roll 75 mm wide × 125 mm long. Printed from a PDF at "Actual size / 100%".
- Today tags are made by hand with a Python script (see `reference/`). Those tags print and scan correctly. **The new app must produce the same tag.**

## Users

| Role | Who | Needs |
| --- | --- | --- |
| Store staff | Counter and storeroom workers | Print correct tags fast, no design skills, no SKU rules to remember |
| Admin | Owner / listing team | Prepare product data, check prices, fix wrong data |

## How the outside listing team does it today (Unicommerce) — the pattern we copy

1. Search the SKU in Unicommerce inventory → click Print Barcode.
2. Type the quantity (they choose it; it is **not** taken from stock).
3. Click Print → a CSV downloads with **one row per label** (20 copies = 20 identical rows).
4. Columns include ProductCode, Name, Color, Size, Brand, **ScanIdentifier**, MRP. The label software makes the barcode from **ScanIdentifier**.
5. Label software (template linked to the CSV) prints the labels.

Unicommerce can fill the CSV because the product data lives inside Unicommerce. For us the product data lives in **Shopify** — so Phase 2 reads Shopify through its Admin API.

## Phase 1 — Semi-automatic (build now)

Goal: anyone can turn a CSV into correct KSH tags in under 2 minutes.

Workflow:

1. Admin (or Claude via the Shopify connector) prepares a CSV in the format of `02_CSV_FORMAT.md`.
2. Staff open **KSH Tag Studio** in the browser and drop the CSV on the page.
3. App validates every row and shows a table: barcode, name, colour, size, MRP, our price, you save, copies, status (Ready / Error + reason).
4. App shows a live preview of the selected tag (exact print look).
5. Staff click **Test print (1 each)** → PDF with one tag per product. Print, scan each one.
6. Staff click **Download print PDF** → PDF with one page per copy, in CSV order. Print at Actual size / 100%.
7. Staff can edit Copies in the table before downloading. They can also download the CSV template.

Rules:

- Runs entirely in the browser. No server, no login, no secrets. Nothing is uploaded anywhere.
- A row with any error is never printed; the error is shown next to the row.
- Works offline once loaded (nice to have).

## Phase 2 — Automatic (after Phase 1 is in use)

Goal: staff do not need a prepared CSV.

Workflow:

1. Staff log in (username + PIN).
2. Search by scanning the barcode, typing a SKU, or typing words of the title.
3. App shows the tag row filled from Shopify (name, colour, size range, MRP, our price). Staff type **Quantity** (default empty; required; 1–999).
4. Add more products to the list the same way.
5. Click **OK / Generate** → app downloads:
   - the expanded CSV (one row per label, same format as the Unicommerce export, our columns), and
   - the print PDF (same renderer as Phase 1).
6. Every generate is saved in a print log (who, when, which codes, how many).

Rules:

- Quantity is always typed by staff (not auto from stock). Stock may be shown as information only.
- Product data is read live from Shopify at generate time; the browser never decides prices.
- A product with missing data (no KSH price, no MRP, no barcode) is shown as Blocked with the reason and is not printed.

## Out of scope (both phases)

- Writing anything to Shopify or EasyEcom.
- Direct ZPL printing to the Zebra (possible Phase 3).
- Customer-facing pages.

## Success = 

- Tags from the app look the same as `reference/tag_example_*.png` and scan in Shopify POS at KSH.
- Staff print 18 products × their quantities without help.
