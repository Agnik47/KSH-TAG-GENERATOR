/**
 * QR test tags for the small 51 × 32 mm label roll: one tag per page, page = the label.
 *
 *   npm run scan-test     → docs/TEST_CODE/KSH_QR_51x32_NEW_SKU.pdf and …_OLD_SKU.pdf
 *
 * Products come from samples/ksh_tags_sample_input.csv. Each QR code holds only the
 * ScanIdentifier (exactly what the line barcode holds), so Shopify POS can match it to the
 * product's Barcode field. "Old" = Color or Size filled (docs/02), like the app.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import bwipjs from 'bwip-js';
import Papa from 'papaparse';
import { PDFDocument, fill, rectangle, rgb, setFillingGrayscaleColor } from 'pdf-lib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'TEST_CODE');

const MM = 72 / 25.4;
const DOT = 25.4 / 300; // one printer dot at 300 dpi (mm)
const W = 51; // label width across the printer (mm)
const H = 32; // label length (mm)
const EDGE = 2.5; // margin to the label edge (mm); ≥ 4 QR squares of quiet zone
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.38, 0.38, 0.38);

/** QR squares are whole printer dots; aim for a ~12.5 mm code (squares ≥ 0.5 mm suit phone cameras). */
const QR_TARGET_MM = 12.5;

const half = (n) => Math.floor(n + 0.5 + 1e-9);
const price = (t) => Number(String(t).replace(/[₹,\s]/g, ''));

function loadProducts() {
  const csv = readFileSync(join(ROOT, 'samples', 'ksh_tags_sample_input.csv'), 'utf8');
  return Papa.parse(csv, { header: true, skipEmptyLines: true }).data.map((r) => {
    const mrp = price(r.MRP);
    const our = half(price(r.OurPrice));
    return {
      code: r.ScanIdentifier.trim(),
      name: r.ProductName.trim(),
      color: (r.Color ?? '').trim(),
      size: (r.Size ?? '').trim(),
      mrp,
      our,
      save: Math.max(0, half(mrp - our)),
    };
  });
}

function qr(value) {
  const r = bwipjs.raw('qrcode', value, { eclevel: 'M' })[0];
  return { n: r.pixx, dark: (x, y) => r.pixs[y * r.pixx + x] === 1 };
}

async function makeTags(title, products, file) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setCreator('KSH Tag Studio (scan test)');
  const R = await doc.embedFont(readFileSync(join(ROOT, 'public/fonts/DejaVuSans.ttf')), { subset: false });
  const B = await doc.embedFont(readFileSync(join(ROOT, 'public/fonts/DejaVuSans-Bold.ttf')), { subset: false });

  const width = (font, t, size) => font.widthOfTextAtSize(t, size) / MM;
  const fit = (font, t, size, max, min) => {
    while (width(font, t, size) > max && size > min) size = Math.round((size - 0.25) * 100) / 100;
    return size;
  };
  /** Shorten with "…" if it still does not fit at `size`. */
  const clip = (font, t, size, max) => {
    if (width(font, t, size) <= max) return t;
    while (t.length > 1 && width(font, `${t}…`, size) > max) t = t.slice(0, -1).trimEnd();
    return `${t}…`;
  };
  const cap = (size) => (size * 0.76) / MM; // height above the baseline (mm)
  const desc = (size) => (size * 0.24) / MM;

  for (const p of products) {
    const page = doc.addPage([W * MM, H * MM]);
    const text = (t, x, y, size, font = R, color = BLACK) => page.drawText(t, { x: x * MM, y: y * MM, size, font, color });
    const old = p.color !== '' || p.size !== '';

    // 1) Product name across the top (bold, shrinks to 5 pt, then "…").
    const nameMax = W - 2 * EDGE;
    const nameSize = fit(B, p.name, 7, nameMax, 5);
    const name = clip(B, p.name, nameSize, nameMax);
    const nameBase = H - EDGE - cap(nameSize);
    text(name, EDGE, nameBase, nameSize, B);

    // 2) Code across the bottom (bold, centred).
    const codeSize = fit(B, p.code, 6.5, W - 2 * EDGE, 4.5);
    const codeBase = EDGE + desc(codeSize);
    text(p.code, (W - width(B, p.code, codeSize)) / 2, codeBase, codeSize, B);

    // 3) QR on the left, centred between name and code. All squares in one filled path (no seams).
    const m = qr(p.code);
    const dots = Math.max(5, Math.round(QR_TARGET_MM / m.n / DOT));
    const s = dots * DOT;
    const q = m.n * s;
    const areaTop = nameBase - desc(nameSize) - 1.2;
    const areaBottom = codeBase + cap(codeSize) + 1.2;
    const qx = Math.round(EDGE / DOT) * DOT;
    const qy = Math.round((areaBottom + (areaTop - areaBottom - q) / 2) / DOT) * DOT;
    const ops = [setFillingGrayscaleColor(0)];
    for (let row = 0; row < m.n; row++) {
      for (let col = 0; col < m.n;) {
        if (!m.dark(col, row)) {
          col++;
          continue;
        }
        let end = col;
        while (end < m.n && m.dark(end, row)) end++;
        ops.push(rectangle((qx + col * s) * MM, (qy + (m.n - row - 1) * s) * MM, (end - col) * s * MM, s * MM));
        col = end;
      }
    }
    ops.push(fill());
    page.pushOperators(...ops);

    // 4) Prices to the right of the QR, vertically centred in the same area.
    const rx = qx + q + 2.6;
    const rw = W - EDGE - rx;
    const mrpAmount = `₹${p.mrp.toFixed(2)}`;
    const ourText = `₹${p.our}`;
    const saveText = `You save ₹${p.save}`;
    const lines = [];
    if (old && p.size) {
      const t = `Size: ${p.size}`;
      lines.push({ t, font: B, size: fit(B, t, 6, rw, 4.5), gap: 1.2 });
    }
    lines.push({ kind: 'mrp', size: 5.5, gap: 0.5 });
    lines.push({ t: '(Incl. of all taxes)', font: R, size: fit(R, '(Incl. of all taxes)', 4.5, rw, 4), gap: 1.2 });
    lines.push({ t: ourText, font: B, size: fit(B, ourText, 15, rw, 9), gap: 0.9 });
    if (p.save > 0) lines.push({ t: saveText, font: R, size: fit(R, saveText, 5.5, rw, 4.5), gap: 0 });

    const lineH = (l) => cap(l.size) + desc(l.size);
    const blockH = lines.reduce((h, l, i) => h + lineH(l) + (i < lines.length - 1 ? l.gap : 0), 0);
    let top = (areaTop + areaBottom + blockH) / 2;
    for (const l of lines) {
      const base = top - cap(l.size);
      if (l.kind === 'mrp') {
        // "MRP" then the amount in grey with a black strike-through line.
        text('MRP ', rx, base, l.size, R, GREY);
        const ax = rx + width(R, 'MRP ', l.size);
        const amountSize = fit(R, mrpAmount, l.size, rw - (ax - rx), 4.5);
        text(mrpAmount, ax, base, amountSize, R, GREY);
        const ly = base + cap(amountSize) * 0.42;
        page.drawLine({
          start: { x: (ax - 0.2) * MM, y: ly * MM },
          end: { x: (ax + width(R, mrpAmount, amountSize) + 0.2) * MM, y: ly * MM },
          thickness: 0.6,
          color: BLACK,
        });
      } else {
        text(l.t, rx, base, l.size, l.font);
      }
      top = base - desc(l.size) - l.gap;
    }
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, file), await doc.save());
  console.log(`docs/TEST_CODE/${file}: ${doc.getPageCount()} tags`);
}

const products = loadProducts();
const isOld = (p) => p.color !== '' || p.size !== '';
await makeTags(
  'KSH QR tags 51 × 32 – new SKUs',
  products.filter((p) => !isOld(p)),
  'KSH_QR_51x32_NEW_SKU.pdf',
);
await makeTags('KSH QR tags 51 × 32 – old SKUs', products.filter(isOld), 'KSH_QR_51x32_OLD_SKU.pdf');
