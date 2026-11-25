# 04 — Shopify data (Phase 2 only)

Phase 1 does not touch Shopify. This file is for Phase 2 (search SKU → auto-fill).

## Store facts (config, not secrets)

| Key | Value |
| --- | --- |
| Store domain | `bp9qw7-1x.myshopify.com` |
| Admin API version | `2026-10` |
| KSH location | `gid://shopify/Location/97639891180` ("Kids Surplus Hub") |
| KSH price list | `gid://shopify/PriceList/28015427820` ("Kids Surplus Hub prices", INR) |

## Access

- New "admin-created custom apps" can no longer be made in Shopify. Use a **Dev Dashboard app** installed on the store and the **client-credentials grant** (server-side) to get an Admin API token. See shopify.dev → "Authenticate an app for stores in your organization".
- Scopes: `read_products` (also covers price lists), `read_inventory`, `read_locations`. **Read-only. Never call a mutation.**
- Secrets only in server env: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`. Cache the token; refresh before expiry.
- In Claude Code, connect the **Shopify Dev MCP** (`npx -y @shopify/dev-mcp@latest`) to look up and validate the GraphQL schema. Do not guess fields.

## Two product families

| | Old (Wishkaro styles) | New (KSH Surplus) |
| --- | --- | --- |
| Example SKU | `bt539cfe_1-2_Years` | `15-M-PNT-MKI-26-Q20-HYS-11` |
| Detect | variant SKU matches `^[A-Za-z0-9]+_\d+-\d+_(Months\|Years)$` | product tag `KSH-Surplus` |
| One tag per | colour (all sizes of a colour share one barcode) | product (single variant) |
| ScanIdentifier | variant barcode = parent code, e.g. `bt539cfe` (verified: all 5 sizes carry it) | variant barcode = full SKU |
| ProductName | product title minus the style-code word, e.g. "Baby Boys Casual T-shirt Shorts bt539" → "Baby Boys Casual T-shirt Shorts" | short tag name (see open decision in 05) — default: product title |
| Color | variant option "Color", title case, trailing "-1" removed | empty |
| Size | range over sizes (rule below) | empty |
| OurPrice | **highest** KSH fixed price across all sizes of that colour, rounded to rupees (bt539cfe: 280, 280, 280, 282.10, 280 → ₹282) | KSH fixed price |
| MRP | KSH price-list `compareAtPrice` (**missing today for old products** → Blocked "No MRP"; see 05) | KSH price-list `compareAtPrice` (set for all 18) |

## Rules

1. Prices only from **fixed prices** in the KSH price list. The list has a +5% parent adjustment, so never use the variant's own price or compute one. No fixed price → Blocked "No KSH price".
2. Size range: parse each SKU suffix `_<a>-<b>_<Months|Years>` into months (Years × 12). Range = min start – max end over sizes with KSH available > 0; if none in stock, all sizes. Format: whole years `nY` (24 → 2Y), else `nM` (0 → 0M). Join with " – " (en dash). Example: 0-3_Months … 1-2_Years → `0M – 2Y`.
3. Style-code removal: drop any title word that, lower-cased, is a prefix of the parent code and has 3+ characters; trim spaces, dashes, empty brackets.
4. No barcode → Blocked "No barcode". Unknown SKU pattern and no `KSH-Surplus` tag → Blocked "Unknown product type".
5. Quantity is typed by staff; stock (KSH available) is shown only as info.

## Queries (verify each field with the Dev MCP before use)

1. Variants by scanned/typed code:
   `productVariants(first: 100, query: "barcode:<code> OR sku:<code>")` → `id sku barcodes(first:3){nodes{value}} selectedOptions{name value} product{id title tags} inventoryItem{inventoryLevel(locationId: KSH){quantities(names:["available"]){quantity}}}`.
   For an old variant, query again by its barcode to get every size of that colour.
   Note: `ProductVariant.barcode` is deprecated in 2026-10 → use `barcodes`.
2. KSH prices: `priceList(id: KSH_PRICE_LIST){ prices(first: 100, query: "variant_id:<numeric> OR variant_id:<numeric>") { nodes { price{amount} compareAtPrice{amount} variant{id sku} } } }` (this filter was tested and works).
3. Title search: `products(first: 20, query: "title:*<words>*")` then query 1 per variant.

Respect Shopify's cost-based rate limit; retry THROTTLED with backoff.

## Known good test data (live store, 25 Nov 2026)

| ScanIdentifier | Expected |
| --- | --- |
| `15-M-PNT-MKI-26-Q20-HYS-11` | KSH price 595, MRP 1190, KSH stock 20 |
| `1-MS-VC-26-Q56-WOS-11` | KSH price 295, MRP 590, stock 56 |
| `bt539cfe` | sizes 0-3M … 1-2Y, Color "Red", KSH prices 280/280/280/282.10/280 → ₹282, MRP missing → Blocked until backfilled |
