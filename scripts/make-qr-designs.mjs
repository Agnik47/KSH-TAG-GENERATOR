/**
 * Five QR tag design options for the 51 × 32 mm label (one tag per page, page = the label),
 * plus an A4 overview with all designs at 100%. For choosing a design only: the app is not changed.
 *
 *   node scripts/make-qr-designs.mjs   → docs/TEST_CODE/QR_Design_*.pdf
 *
 * Same design for old and new SKUs. The QR holds only the ScanIdentifier (what Shopify POS
 * matches to the product's Barcode field). Black only, no grey: thermal printers dither grey.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import bwipjs from 'bwip-js';
import Papa from 'papaparse';
import {
  PDFDocument,
  degrees,
  fill,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  rgb,
  setCharacterSpacing,
  setFillingGrayscaleColor,
} from 'pdf-lib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'TEST_CODE');

const MM = 72 / 25.4;
const DOT = 25.4 / 300; // printer dot (mm)
const W = 51;
const H = 32;
const STORE = 'KIDS SURPLUS HUB';
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const QR_TARGET_MM = 12.5; // squares ≥ 0.5 mm: comfortable for phone cameras

/** Tags shown in every design: long code + 4-digit MRP, long name, short name, and the two old SKUs. */
const PICK = ['15-M-PNT-MKI-26-Q20-HYS-11', '6-MS-MKI-26-Q45-IOT-11', '10-LG-MKI-26-Q32-RT-11', 'bt539cfe', 'bt624y'];

const round = (n) => Math.floor(n + 0.5 + 1e-9);
const num = (t) => Number(String(t).replace(/[₹,\s]/g, ''));

function loadProducts() {
  const csv = readFileSync(join(ROOT, 'samples', 'ksh_tags_sample_input.csv'), 'utf8');
  const rows = Papa.parse(csv, { header: true, skipEmptyLines: true }).data.map((r) => {
    const mrp = num(r.MRP);
    const our = round(num(r.OurPrice));
    return {
      code: r.ScanIdentifier.trim(),
      name: r.ProductName.trim(),
      color: (r.Color ?? '').trim(),
      size: (r.Size ?? '').trim(),
      mrp,
      our,
      save: Math.max(0, round(mrp - our)),
    };
  });
  return PICK.map((c) => rows.find((r) => r.code === c));
}

function qrMatrix(value) {
  const r = bwipjs.raw('qrcode', value, { eclevel: 'M' })[0];
  return { n: r.pixx, dark: (x, y) => r.pixs[y * r.pixx + x] === 1 };
}

/** Drawing helpers for one page (mm, origin bottom-left). */
function kit(page, R) {
  const width = (t, font, size, track = 0) => (font.widthOfTextAtSize(t, size) + track * t.length) / MM;
  const cap = (size) => (size * 0.76) / MM;
  const desc = (size) => (size * 0.24) / MM;
  const fit = (t, font, size, max, min = 4.5) => {
    while (width(t, font, size) > max && size > min) size = Math.round((size - 0.25) * 100) / 100;
    return size;
  };
  const clip = (t, font, size, max) => {
    if (width(t, font, size) <= max) return t;
    while (t.length > 1 && width(`${t}…`, font, size) > max) t = t.slice(0, -1).trimEnd();
    return `${t}…`;
  };
  /** Text with optional letter spacing (`track` in pt). Returns its width (mm). */
  const text = (t, x, y, size, font = R, { color = BLACK, track = 0, rotate = 0 } = {}) => {
    if (track) page.pushOperators(pushGraphicsState(), setCharacterSpacing(track));
    page.drawText(t, { x: x * MM, y: y * MM, size, font, color, rotate: degrees(rotate) });
    if (track) page.pushOperators(popGraphicsState());
    return width(t, font, size, track);
  };
  const centre = (t, cx, y, size, font = R, opts = {}) =>
    text(t, cx - width(t, font, size, opts.track ?? 0) / 2, y, size, font, opts);
  const line = (x1, y1, x2, y2, thickness = 0.5) =>
    page.drawLine({ start: { x: x1 * MM, y: y1 * MM }, end: { x: x2 * MM, y: y2 * MM }, thickness, color: BLACK });
  /** Rounded rectangle, filled or outlined. */
  const roundRect = (x, y, w, h, r, { fillColor, border } = {}) => {
    const [pw, ph, pr] = [w * MM, h * MM, r * MM];
    const d = `M ${pr} 0 H ${pw - pr} A ${pr} ${pr} 0 0 1 ${pw} ${pr} V ${ph - pr} A ${pr} ${pr} 0 0 1 ${pw - pr} ${ph} H ${pr} A ${pr} ${pr} 0 0 1 0 ${ph - pr} V ${pr} A ${pr} ${pr} 0 0 1 ${pr} 0 Z`;
    page.drawSvgPath(d, {
      x: x * MM,
      y: (y + h) * MM,
      color: fillColor,
      borderColor: border ? BLACK : undefined,
      borderWidth: border ?? 0,
    });
  };
  /** Up to two lines, shrinking from `size` to `min`; the second line gets "…" if still too long. */
  const wrap2 = (t, font, size, max, min = 5) => {
    const split = (s) => {
      const words = t.split(' ');
      const lines = [''];
      for (const w of words) {
        const cur = lines[lines.length - 1];
        const next = cur ? `${cur} ${w}` : w;
        if (!cur || width(next, font, s) <= max) lines[lines.length - 1] = next;
        else lines.push(w);
      }
      return lines;
    };
    let s = size;
    let lines = split(s);
    while ((lines.length > 2 || lines.some((l) => width(l, font, s) > max)) && s > min) {
      s = Math.round((s - 0.25) * 100) / 100;
      lines = split(s);
    }
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
    return { size: s, lines: lines.map((l) => clip(l, font, s, max)) };
  };
  /** QR with its bottom-left at (x, y), squares snapped to printer dots; one filled path (no seams). Returns its size. */
  const qr = (value, x, y, target = QR_TARGET_MM) => {
    const m = qrMatrix(value);
    const dots = Math.max(5, Math.round(target / m.n / DOT));
    const s = dots * DOT;
    const q = m.n * s;
    x = Math.round(x / DOT) * DOT;
    y = Math.round(y / DOT) * DOT;
    const ops = [setFillingGrayscaleColor(0)];
    for (let row = 0; row < m.n; row++) {
      for (let col = 0; col < m.n;) {
        if (!m.dark(col, row)) {
          col++;
          continue;
        }
        let end = col;
        while (end < m.n && m.dark(end, row)) end++;
        ops.push(rectangle((x + col * s) * MM, (y + (m.n - row - 1) * s) * MM, (end - col) * s * MM, s * MM));
        col = end;
      }
    }
    ops.push(fill());
    page.pushOperators(...ops);
    return q;
  };
  /** Size of the QR for a value (mm), without drawing it. */
  const qrSize = (value, target = QR_TARGET_MM) => {
    const m = qrMatrix(value);
    return m.n * Math.max(5, Math.round(target / m.n / DOT)) * DOT;
  };
  /** "₹1190.00" with a strike-through line. Returns its width. */
  const struck = (t, x, y, size, font = R) => {
    const w = text(t, x, y, size, font);
    line(x - 0.2, y + cap(size) * 0.42, x + w + 0.2, y + cap(size) * 0.42, Math.max(0.45, size * 0.09));
    return w;
  };
  return { width, cap, desc, fit, clip, text, centre, line, roundRect, wrap2, qr, qrSize, struck };
}

const mrpText = (p) => `₹${p.mrp.toFixed(2)}`;
const isOld = (p) => p.color !== '' || p.size !== '';

/** Lays out a column of lines from a top y; returns the y under the last line. */
function stack(k, x, top, lines) {
  let y = top;
  for (const l of lines) {
    if (!l) continue;
    y -= l.before ?? 0;
    const base = y - k.cap(l.size);
    l.draw(x, base);
    y = base - k.desc(l.size) - (l.after ?? 0);
  }
  return y;
}
const stackHeight = (k, lines) =>
  lines.filter(Boolean).reduce((h, l) => h + (l.before ?? 0) + k.cap(l.size) + k.desc(l.size) + (l.after ?? 0), 0);

// ---------------------------------------------------------------------------------------------
// The five designs. Each draws one tag (51 × 32 mm) for product `p`.
// ---------------------------------------------------------------------------------------------

const DESIGNS = [
  {
    file: 'QR_Design_1_Classic.pdf',
    title: '1 · Classic',
    note: 'Store name + rule on top, name, QR left, prices right, code at the bottom.',
    draw(k, p, { R, B }) {
      const E = 2.2;
      // Store name with letter spacing, and a thin rule under it.
      const storeBase = H - E - k.cap(5.2);
      k.text(STORE, E, storeBase, 5.2, B, { track: 0.6 });
      k.line(E, storeBase - 1.1, W - E, storeBase - 1.1, 0.5);
      // Product name.
      const nameSize = k.fit(p.name, B, 7, W - 2 * E, 5);
      const nameBase = storeBase - 1.1 - 1.2 - k.cap(nameSize);
      k.text(k.clip(p.name, B, nameSize, W - 2 * E), E, nameBase, nameSize, B);
      // Code at the bottom.
      const codeSize = k.fit(p.code, B, 6, W - 2 * E, 4.5);
      const codeBase = E + k.desc(codeSize);
      k.centre(p.code, W / 2, codeBase, codeSize, B);
      // QR (left) and prices (right) centred in the middle band.
      const top = nameBase - k.desc(nameSize) - 1.3;
      const bottom = codeBase + k.cap(codeSize) + 1.3;
      const q = k.qrSize(p.code);
      k.qr(p.code, E + 0.3, bottom + (top - bottom - q) / 2);
      const rx = E + 0.3 + q + 2.6;
      const rw = W - E - rx;
      const lines = [
        isOld(p) && {
          size: 5.8,
          after: 1.1,
          draw: (x, y) => k.text(`Size: ${p.size}`, x, y, k.fit(`Size: ${p.size}`, B, 5.8, rw), B),
        },
        { size: 5.5, after: 0.5, draw: (x, y) => k.struck(`MRP ${mrpText(p)}`, x, y, k.fit(`MRP ${mrpText(p)}`, R, 5.5, rw)) },
        { size: 4.3, after: 1.1, draw: (x, y) => k.text('(Incl. of all taxes)', x, y, 4.3) },
        { size: 14, after: 0.9, draw: (x, y) => k.text(`₹${p.our}`, x, y, k.fit(`₹${p.our}`, B, 14, rw, 9), B) },
        p.save > 0 && { size: 5.3, draw: (x, y) => k.text(`You save ₹${p.save}`, x, y, 5.3) },
      ];
      stack(k, rx, (top + bottom + stackHeight(k, lines)) / 2, lines);
    },
  },
  {
    file: 'QR_Design_2_Black_Header.pdf',
    title: '2 · Black header',
    note: 'Black band with the store name in white, centred name, prices left, QR right.',
    draw(k, p, { R, B }) {
      const E = 2.2;
      // Black rounded band with white store name.
      const bandH = 5.4;
      k.roundRect(1.3, H - 1.3 - bandH, W - 2.6, bandH, 1.1, { fillColor: BLACK });
      k.centre(STORE, W / 2, H - 1.3 - bandH / 2 - k.cap(6) / 2, 6, B, { color: WHITE, track: 1 });
      // Product name, centred.
      const nameSize = k.fit(p.name, B, 6.8, W - 2 * E, 5);
      const nameBase = H - 1.3 - bandH - 1.3 - k.cap(nameSize);
      k.centre(k.clip(p.name, B, nameSize, W - 2 * E), W / 2, nameBase, nameSize, B);
      // Code at the bottom.
      const codeSize = k.fit(p.code, B, 6, W - 2 * E, 4.5);
      const codeBase = E + k.desc(codeSize);
      k.centre(p.code, W / 2, codeBase, codeSize, B);
      // QR right, prices left.
      const top = nameBase - k.desc(nameSize) - 1.3;
      const bottom = codeBase + k.cap(codeSize) + 1.3;
      const q = k.qrSize(p.code);
      const qx = W - E - 0.3 - q;
      k.qr(p.code, qx, bottom + (top - bottom - q) / 2);
      const rw = qx - 2.6 - E;
      const lines = [
        isOld(p) && {
          size: 5.8,
          after: 1,
          draw: (x, y) => k.text(`Size: ${p.size}`, x, y, k.fit(`Size: ${p.size}`, B, 5.8, rw), B),
        },
        { size: 15, after: 1, draw: (x, y) => k.text(`₹${p.our}`, x, y, k.fit(`₹${p.our}`, B, 15, rw, 9), B) },
        { size: 5.5, after: 0.5, draw: (x, y) => k.struck(`MRP ${mrpText(p)}`, x, y, k.fit(`MRP ${mrpText(p)}`, R, 5.5, rw)) },
        { size: 4.3, draw: (x, y) => k.text('(Incl. of all taxes)', x, y, 4.3) },
      ];
      stack(k, E, (top + bottom + stackHeight(k, lines)) / 2, lines);
    },
  },
  {
    file: 'QR_Design_3_Big_Price.pdf',
    title: '3 · Big price + save badge',
    note: 'Price is the hero; black "SAVE" badge; QR right; code under a rule.',
    draw(k, p, { R, B }) {
      const E = 2.2;
      // Bottom strip: rule + code.
      const codeSize = k.fit(p.code, B, 5.8, W - 2 * E, 4.5);
      const codeBase = E + k.desc(codeSize);
      k.centre(p.code, W / 2, codeBase, codeSize, B);
      const ruleY = codeBase + k.cap(codeSize) + 1.1;
      k.line(E, ruleY, W - E, ruleY, 0.5);
      // QR on the right, centred above the rule.
      const q = k.qrSize(p.code);
      const qx = W - E - 0.3 - q;
      k.qr(p.code, qx, ruleY + 1.6 + (H - E - ruleY - 1.6 - q) / 2);
      // Left column.
      const cw = qx - 2.4 - E;
      const name = k.wrap2(p.name, B, 6.2, cw, 5);
      const save = `SAVE ₹${p.save}`;
      const lines = [
        { size: 4.6, after: 1, draw: (x, y) => k.text(STORE, x, y, 4.6, B, { track: 0.45 }) },
        ...name.lines.map((l, i) => ({
          size: name.size,
          after: i === name.lines.length - 1 ? 0.9 : 0.35,
          draw: (x, y) => k.text(l, x, y, name.size, B),
        })),
        isOld(p) && {
          size: 5.4,
          after: 0.9,
          draw: (x, y) => k.text(`Size: ${p.size}`, x, y, k.fit(`Size: ${p.size}`, R, 5.4, cw), R),
        },
        { size: 16, after: 1.2, draw: (x, y) => k.text(`₹${p.our}`, x, y, k.fit(`₹${p.our}`, B, 16, cw, 9), B) },
        {
          size: 5,
          draw: (x, y) => {
            const w = k.struck(`MRP ${mrpText(p)}`, x, y, 5);
            if (p.save > 0) {
              const bs = 4.6;
              const bw = k.width(save, B, bs) + 2;
              const bx = x + w + 1.4;
              if (bx + bw <= x + cw) {
                k.roundRect(bx, y - 0.75, bw, k.cap(bs) + 1.5, 0.8, { fillColor: BLACK });
                k.text(save, bx + 1, y, bs, B, { color: WHITE });
              }
            }
          },
        },
        { size: 3.9, before: 0.7, draw: (x, y) => k.text('(Incl. of all taxes)', x, y, 3.9) },
      ];
      stack(k, E, H - E, lines);
    },
  },
  {
    file: 'QR_Design_4_Framed.pdf',
    title: '4 · Framed',
    note: 'Rounded frame, store name centred between rules, QR left, name + price right.',
    draw(k, p, { R, B }) {
      const F = 1.2; // frame inset
      k.roundRect(F, F, W - 2 * F, H - 2 * F, 1.8, { border: 0.6 });
      const E = F + 1.6;
      // Store name centred, short rules either side.
      const sSize = 5;
      const sBase = H - E - k.cap(sSize);
      const sw = k.width(STORE, B, sSize, 0.5);
      k.centre(STORE, W / 2, sBase, sSize, B, { track: 0.5 });
      const ly = sBase + k.cap(sSize) / 2;
      k.line(E + 1, ly, W / 2 - sw / 2 - 1.5, ly, 0.5);
      k.line(W / 2 + sw / 2 + 1.5, ly, W - E - 1, ly, 0.5);
      // Code at the bottom, inside the frame.
      const codeSize = k.fit(p.code, B, 5.6, W - 2 * E, 4.5);
      const codeBase = E + k.desc(codeSize) - 0.2;
      k.centre(p.code, W / 2, codeBase, codeSize, B);
      // QR left (≥ 2 mm from the frame line), text right.
      const top = sBase - k.desc(sSize) - 1.3;
      const bottom = codeBase + k.cap(codeSize) + 1.2;
      const q = k.qrSize(p.code, 12);
      const qx = F + 2.2;
      k.qr(p.code, qx, bottom + (top - bottom - q) / 2, 12);
      const rx = qx + q + 2.4;
      const rw = W - E - rx;
      const name = k.wrap2(p.name, B, 6.2, rw, 5);
      const lines = [
        ...name.lines.map((l, i) => ({
          size: name.size,
          after: i === name.lines.length - 1 ? 0.9 : 0.35,
          draw: (x, y) => k.text(l, x, y, name.size, B),
        })),
        isOld(p) && {
          size: 5.2,
          after: 0.9,
          draw: (x, y) => k.text(`Size: ${p.size}`, x, y, k.fit(`Size: ${p.size}`, R, 5.2, rw), R),
        },
        { size: 13, after: 0.8, draw: (x, y) => k.text(`₹${p.our}`, x, y, k.fit(`₹${p.our}`, B, 13, rw, 9), B) },
        { size: 4.8, draw: (x, y) => k.struck(`MRP ${mrpText(p)}`, x, y, k.fit(`MRP ${mrpText(p)}`, R, 4.8, rw)) },
        { size: 3.9, before: 0.4, draw: (x, y) => k.text('Incl. of all taxes', x, y, 3.9) },
      ];
      stack(k, rx, (top + bottom + stackHeight(k, lines)) / 2, lines);
    },
  },
  {
    file: 'QR_Design_5_Side_Stripe.pdf',
    title: '5 · Side stripe',
    note: 'Black stripe on the left with the store name upright, QR, name + prices, code below.',
    draw(k, p, { R, B }) {
      // Black stripe with the store name reading bottom-to-top in white.
      const sx = 1.3;
      const sw = 5.2;
      k.roundRect(sx, 1.3, sw, H - 2.6, 1.1, { fillColor: BLACK });
      const ss = 5.6;
      const len = k.width(STORE, B, ss, 0.7);
      k.text(STORE, sx + sw / 2 + k.cap(ss) / 2, (H - len) / 2, ss, B, { color: WHITE, track: 0.7, rotate: 90 });
      // Code along the bottom, right of the stripe.
      const x0 = sx + sw + 2.2; // ≥ 2 mm white between the stripe and the QR
      const E = 2.2;
      const codeSize = k.fit(p.code, B, 5.8, W - E - x0, 4.5);
      const codeBase = E + k.desc(codeSize);
      k.centre(p.code, (x0 + W - E) / 2, codeBase, codeSize, B);
      // QR, then name and prices.
      const top = H - E;
      const bottom = codeBase + k.cap(codeSize) + 1.3;
      const q = k.qrSize(p.code);
      k.qr(p.code, x0, bottom + (top - bottom - q) / 2);
      const rx = x0 + q + 2.4;
      const rw = W - E - rx;
      const name = k.wrap2(p.name, B, 6.2, rw, 5);
      const lines = [
        ...name.lines.map((l, i) => ({
          size: name.size,
          after: i === name.lines.length - 1 ? 0.9 : 0.35,
          draw: (x, y) => k.text(l, x, y, name.size, B),
        })),
        isOld(p) && {
          size: 5.2,
          after: 0.9,
          draw: (x, y) => k.text(`Size: ${p.size}`, x, y, k.fit(`Size: ${p.size}`, R, 5.2, rw), R),
        },
        { size: 4.9, after: 0.3, draw: (x, y) => k.struck(`MRP ${mrpText(p)}`, x, y, k.fit(`MRP ${mrpText(p)}`, R, 4.9, rw)) },
        { size: 3.9, after: 0.6, draw: (x, y) => k.text('(Incl. of all taxes)', x, y, 3.9) },
        { size: 13.5, after: 0.7, draw: (x, y) => k.text(`₹${p.our}`, x, y, k.fit(`₹${p.our}`, B, 13.5, rw, 9), B) },
        p.save > 0 && {
          size: 4.8,
          draw: (x, y) => k.text(`You save ₹${p.save}`, x, y, k.fit(`You save ₹${p.save}`, R, 4.8, rw)),
        },
      ];
      stack(k, rx, (top + bottom + stackHeight(k, lines)) / 2, lines);
    },
  },
];

async function newDoc(title) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setCreator('KSH Tag Studio (QR design options)');
  const fonts = {
    R: await doc.embedFont(readFileSync(join(ROOT, 'public/fonts/DejaVuSans.ttf')), { subset: false }),
    B: await doc.embedFont(readFileSync(join(ROOT, 'public/fonts/DejaVuSans-Bold.ttf')), { subset: false }),
  };
  return { doc, fonts };
}

const products = loadProducts();
mkdirSync(OUT, { recursive: true });

const made = [];
for (const d of DESIGNS) {
  const { doc, fonts } = await newDoc(`KSH QR tag – design ${d.title}`);
  for (const p of products) {
    const page = doc.addPage([W * MM, H * MM]);
    d.draw(kit(page, fonts.R), p, fonts);
  }
  const bytes = await doc.save();
  writeFileSync(join(OUT, d.file), bytes);
  made.push({ d, bytes });
  console.log(`docs/TEST_CODE/${d.file}: ${products.length} tags`);
}

// A4 overview: every design, 3 tags each (2 new + 1 old), at 100% with a thin outline.
{
  const { doc, fonts } = await newDoc('KSH QR tag designs – overview');
  const A4 = [210, 297];
  const page = doc.addPage([A4[0] * MM, A4[1] * MM]);
  const k = kit(page, fonts.R);
  k.text('KSH QR tag designs · 51 × 32 mm · actual size (print at 100%)', 12, A4[1] - 16, 11, fonts.B);
  k.text(
    'Pick one design. Each design also has its own PDF with one tag per page for the label printer.',
    12,
    A4[1] - 21.5,
    7.5,
    fonts.R,
  );
  const show = [0, 1, 3]; // pants (long code), premium casual shirt (long name), bt539cfe (old)
  let y = A4[1] - 32;
  for (const { d, bytes } of made) {
    const src = await PDFDocument.load(bytes);
    const pages = await doc.embedPdf(src, show);
    k.text(d.title, 12, y - 3, 9, fonts.B);
    k.text(d.note, 12, y - 7.5, 6.5, fonts.R);
    const ty = y - 10 - H;
    pages.forEach((ep, i) => {
      const tx = 12 + i * (W + 10);
      page.drawPage(ep, { x: tx * MM, y: ty * MM, width: W * MM, height: H * MM });
      page.drawRectangle({
        x: tx * MM,
        y: ty * MM,
        width: W * MM,
        height: H * MM,
        borderColor: rgb(0.6, 0.6, 0.6),
        borderWidth: 0.4,
      });
    });
    y = ty - 8;
  }
  writeFileSync(join(OUT, 'QR_Designs_Overview_A4.pdf'), await doc.save());
  console.log('docs/TEST_CODE/QR_Designs_Overview_A4.pdf: overview');
}
