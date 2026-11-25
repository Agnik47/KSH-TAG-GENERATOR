# 05 — Decisions and open questions

## Decided

| # | Decision | Why |
| --- | --- | --- |
| D1 | Build in two phases: Phase 1 CSV → tags (browser only), Phase 2 search SKU + quantity → CSV + tags (Shopify) | Phase 1 is useful immediately with zero secrets; Phase 2 reuses its renderer |
| D2 | Next.js (App Router) + TypeScript from day one; Phase 1 pages are client-side only | Owner is a React/Next.js developer; Phase 2 adds API routes without a rewrite |
| D3 | PDF generated in the browser (pdf-lib + fontkit + bwip-js), DejaVu fonts embedded | No server needed for Phase 1; ₹ sign needs an embedded font |
| D4 | Quantity is always typed by staff, never auto from stock | Matches how the listing team works in Unicommerce |
| D5 | ScanIdentifier printed exactly as given; old products keep their parent-code barcode | Thousands of tags already printed with these values |
| D6 | No BarTender | Too complex for staff; licence expires 22-12-2026 |
| D7 | Read-only Shopify access in Phase 2 | The app must never change products, prices or stock |
| D8 | Hosting: Vercel (Phase 1 can also run on any static host) | Simple deploy; Vercel Hobby is not for commercial use → Pro (~$20/month, estimate) or Netlify/Cloudflare Pages for static Phase 1 |

## Open (owner to answer; app must not block on them)

| # | Question | Default until answered |
| --- | --- | --- |
| Q1 | Where do MRPs for old products come from? Not in Shopify yet. | Phase 1: typed in the CSV. Phase 2: Blocked "No MRP" until added to the KSH price list compareAtPrice |
| Q2 | New-product tag name: short name (e.g. "Men's Casual Pants") or full Shopify title? | Phase 2 uses a product metafield `ksh.tag_name` if present, else the product title |
| Q3 | Final titles for 18 new products (#11, #14, #17, #18 unclear: shirt vs shorts, sleepwear vs slippers) | Use the CSV values |
| Q4 | Who gets admin access in Phase 2 | Owner only |
