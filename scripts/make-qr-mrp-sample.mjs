/**
 * SAMPLE ONLY (the app is not changed): the 51 × 32 mm QR tag with the legal details from the
 * old Wishkaro label: "MRP" instead of "PRICE", (Incl. of all taxes), Mfd month, Mfg/Mkt and
 * Country of Origin (no "You save"). The QR code is exactly the one the app prints today (same squares, same size).
 *
 *   node scripts/make-qr-mrp-sample.mjs [Mon-YY]   → docs/TEST_CODE/KSH_QR_51x32_MRP_SAMPLE.pdf
 *
 * Mfd defaults to the current month ("Nov-26").
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import bwipjs from 'bwip-js';
import Papa from 'papaparse';
import {
  PDFDocument,
  fill,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setCharacterSpacing,
  setFillingGrayscaleColor,
} from 'pdf-lib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'TEST_CODE');
const MM = 72 / 25.4;
const DOT = 25.4 / 300;
const W = 51;
const H = 32;
const E = 2.2; // edge margin (mm), same as the app's Classic tag
const BLACK = rgb(0, 0, 0);
const STORE = 'KIDS SURPLUS HUB';
const MFG = 'Mfg/Mkt: K.L. Pvt. Ltd. Bengaluru-67';
const ORIGIN = 'Country of Origin: INDIA';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const now = new Date();
const MFD = process.argv[2] ?? `${MONTHS[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;

const PICK = ['2-MS-MKI-26-Q5-IOT-11', '15-M-PNT-MKI-26-Q20-HYS-11', '6-MS-MKI-26-Q45-IOT-11', 'bt539cfe'];
const round = (n) => Math.floor(n + 0.5 + 1e-9);
const num = (t) => Number(String(t).replace(/[₹,\s]/g, ''));

function products() {
  const rows = Papa.parse(readFileSync(join(ROOT, 'samples', 'ksh_tags_sample_input.csv'), 'utf8'), {
    header: true,
    skipEmptyLines: true,
  }).data.map((r) => {
    const mrp = num(r.MRP);
    const our = round(num(r.OurPrice));
    return {
      code: r.ScanIdentifier.trim(),
      name: r.ProductName.trim(),
      size: (r.Size ?? '').trim(),
      mrp,
      our,
      save: Math.max(0, round(mrp - our)),
    };
  });
  return PICK.map((c) => rows.find((r) => r.code === c));
}

/** Same QR as the app: error correction M, squares of whole dots aimed at 12.5 mm (src/core/tags/barcode/qr.ts). */
function qrMatrix(value) {
  const r = bwipjs.raw('qrcode', value, { eclevel: 'M' })[0];
  const dots = Math.min(8, Math.max(5, Math.round(12.5 / r.pixx / DOT)));
  return { n: r.pixx, dots, size: r.pixx * dots * DOT, dark: (x, y) => r.pixs[y * r.pixx + x] === 1 };
}

function draw(page, p, R, B) {
  const width = (t, f, s, track = 0) => (f.widthOfTextAtSize(t, s) + track * t.length) / MM;
  const cap = (s) => (s * 0.76) / MM;
  const desc = (s) => (s * 0.24) / MM;
  const fit = (t, f, s, max, min = 4) => {
    while (width(t, f, s) > max && s > min) s = Math.round((s - 0.25) * 100) / 100;
    return s;
  };
  const text = (t, x, y, s, f = R, track = 0) => {
    if (track) page.pushOperators(pushGraphicsState(), setCharacterSpacing(track));
    page.drawText(t, { x: x * MM, y: y * MM, size: s, font: f, color: BLACK });
    if (track) page.pushOperators(popGraphicsState());
    return width(t, f, s, track);
  };
  const line = (x1, y1, x2, y2, t = 0.5) =>
    page.drawLine({ start: { x: x1 * MM, y: y1 * MM }, end: { x: x2 * MM, y: y2 * MM }, thickness: t, color: BLACK });

  const textW = W - 2 * E;

  // Store name + rule (unchanged).
  const storeBase = H - E - cap(5.2);
  text(STORE, E, storeBase, 5.2, B, 0.6);
  const ruleY = storeBase - 1.1;
  line(E, ruleY, W - E, ruleY);

  // Product name (unchanged).
  const nameSize = fit(p.name, B, 7, textW, 5);
  const nameBase = ruleY - 1.2 - cap(nameSize);
  text(p.name, E, nameBase, nameSize, B);

  // Bottom, from the edge up: Mfg/Mkt + origin (one line), then the code.
  const footer = `${MFG}  |  ${ORIGIN}`;
  const fSize = fit(footer, R, 4.2, textW, 3.6);
  const fBase = E - 0.6 + desc(fSize);
  text(footer, (W - width(footer, R, fSize)) / 2, fBase, fSize, R);
  const codeSize = fit(p.code, B, 6, textW, 4.5);
  const codeBase = fBase + cap(fSize) + 1.0 + desc(codeSize);
  text(p.code, (W - width(p.code, B, codeSize)) / 2, codeBase, codeSize, B);

  // Middle band: QR left (same as today), prices right.
  const top = nameBase - desc(nameSize) - 1.0;
  const bottom = codeBase + cap(codeSize) + 1.0;
  const m = qrMatrix(p.code);
  const s = m.dots * DOT;
  const qx = Math.round((E + 0.3) / DOT) * DOT;
  const qy = Math.round((bottom + (top - bottom - m.size) / 2) / DOT) * DOT;
  const ops = [setFillingGrayscaleColor(0)];
  for (let row = 0; row < m.n; row++)
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
  ops.push(fill());
  page.pushOperators(...ops);

  const rx = qx + m.size + Math.max(2.6, 4 * s + 0.3);
  const rw = W - E - rx;
  const mrpText = `MRP ₹${p.mrp.toFixed(2)}`;
  const our = `₹${p.our}`;
  // Old SKUs add a Size line: the big price and the gaps get a little smaller so the band keeps air.
  const big = p.size ? 12 : 14;
  const gap = p.size ? 0.6 : 1;
  const lines = [
    p.size && { size: 5.6, after: gap, draw: (x, y) => text(`Size: ${p.size}`, x, y, fit(`Size: ${p.size}`, B, 5.6, rw), B) },
    {
      size: 5.5,
      after: 0.45,
      draw: (x, y) => {
        const ss = fit(mrpText, R, 5.5, rw);
        const w = text(mrpText, x, y, ss, R);
        const ly = y + cap(ss) * 0.42;
        line(x - 0.2, ly, x + w + 0.2, ly, Math.max(0.45, ss * 0.09));
      },
    },
    { size: 4.2, after: gap, draw: (x, y) => text('(Incl. of all taxes)', x, y, 4.2, R) },
    {
      size: big,
      after: gap * 0.8,
      draw: (x, y) => text(our, x, y, fit(our, B, big, rw, 9), B),
    },
    // Mfd takes the old "You save" line: small, regular weight.
    { size: 4.6, draw: (x, y) => text(`Mfd: ${MFD}`, x, y, 4.6, R) },
  ].filter(Boolean);
  const blockH = lines.reduce((h, l, i) => h + cap(l.size) + desc(l.size) + (i < lines.length - 1 ? l.after : 0), 0);
  if (blockH > top - bottom + 0.3)
    console.warn(`  ! ${p.code}: price block ${blockH.toFixed(1)} mm > band ${(top - bottom).toFixed(1)} mm`);
  let y = (top + bottom + blockH) / 2;
  for (const l of lines) {
    const base = y - cap(l.size);
    l.draw(rx, base);
    y = base - desc(l.size) - (l.after ?? 0);
  }
  return {
    qr: `${m.n}×${m.n}, ${m.dots}-dot squares, ${m.size.toFixed(2)} mm`,
    band: (top - bottom).toFixed(1),
    blockH: blockH.toFixed(1),
  };
}

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
doc.setTitle('KSH QR tag 51 × 32 – MRP + legal details (sample)');
const R = await doc.embedFont(readFileSync(join(ROOT, 'public/fonts/DejaVuSans.ttf')), { subset: false });
const B = await doc.embedFont(readFileSync(join(ROOT, 'public/fonts/DejaVuSans-Bold.ttf')), { subset: false });
for (const p of products()) {
  const info = draw(doc.addPage([W * MM, H * MM]), p, R, B);
  console.log(`${p.code}: QR ${info.qr}; price block ${info.blockH} / band ${info.band} mm`);
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'KSH_QR_51x32_MRP_SAMPLE.pdf'), await doc.save());
console.log(`docs/TEST_CODE/KSH_QR_51x32_MRP_SAMPLE.pdf (Mfd: ${MFD})`);
