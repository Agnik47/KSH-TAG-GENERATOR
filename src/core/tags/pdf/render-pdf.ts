/**
 * Render KSH tags to PDF (docs/03).
 *  - print:   one page = one label as it leaves the printer (default 75 × 125 mm roll). When the
 *             design and the label disagree, the design is turned +90° (translate x by the page
 *             width, rotate 90°), as docs/03 does for the 125 × 75 tag on the 75 × 125 roll.
 *  - preview: pages the size of the design, not rotated (for checking on screen)
 * One page per tag in the list given (expand copies first with expandTags()).
 * Tags must be validated for the same label (validationFor(label)) so the bars fit.
 *
 * Each distinct tag is drawn once into a PDF Form XObject, and every copy's page just places
 * that object. 2,000 labels of 20 products therefore cost 20 drawings, not 2,000, which keeps
 * big print jobs fast and the file small. What gets printed is identical either way.
 */
import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  type PDFFont,
  type PDFOperator,
  type PDFRef,
  beginText,
  concatTransformationMatrix,
  drawObject,
  endText,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setCharacterSpacing,
  setFillingGrayscaleColor,
  setFontAndSize,
  setLineWidth,
  setStrokingGrayscaleColor,
  setTextMatrix,
  showText,
  stroke,
} from 'pdf-lib';
import { createFontMetrics, type FontBytes, type FontMetrics } from '../layout/font-metrics';
import { DEFAULT_LABEL, labelGeometry, type LabelSpec } from '../label/label';
import { layoutTag, type DrawOp, type FontId } from '../layout/tag-layout';
import type { TagData } from '../types';

export type PdfMode = 'print' | 'preview';

export const MM_PT = 72 / 25.4;
const mm = (v: number) => v * MM_PT;

/** Page size in points for each mode. */
export function pageSizePt(mode: PdfMode, label: LabelSpec = DEFAULT_LABEL): [number, number] {
  const g = labelGeometry(label);
  return mode === 'print' ? [mm(g.pageW), mm(g.pageH)] : [mm(g.w), mm(g.h)];
}

export interface RenderOptions {
  mode: PdfMode;
  fonts: FontBytes;
  /** Optional metrics (reuse the ones the UI already built). */
  metrics?: FontMetrics;
  title?: string;
  /** Label size and orientation (default: the 75 × 125 roll, horizontal tag). */
  label?: LabelSpec;
}

/** Font resource names used inside every tag XObject. */
const FONT_RES: Record<FontId, string> = { R: 'F1', B: 'F2' };

/** Turn layout instructions into PDF content operators (design space, points). */
function opsToPdf(ops: DrawOp[], fonts: Record<FontId, PDFFont>): PDFOperator[] {
  const out: PDFOperator[] = [];
  for (const op of ops) {
    if (op.kind === 'text') {
      out.push(
        setFillingGrayscaleColor(op.gray),
        beginText(),
        setFontAndSize(FONT_RES[op.font], op.size),
        setTextMatrix(1, 0, 0, 1, mm(op.x), mm(op.y)),
        ...(op.track ? [setCharacterSpacing(op.track)] : []),
        showText(fonts[op.font].encodeText(op.text)),
        ...(op.track ? [setCharacterSpacing(0)] : []),
        endText(),
      );
    } else if (op.kind === 'line') {
      out.push(
        setStrokingGrayscaleColor(0),
        setLineWidth(op.widthPt),
        moveTo(mm(op.x1), mm(op.y1)),
        lineTo(mm(op.x2), mm(op.y2)),
        stroke(),
      );
    } else if (op.kind === 'matrix') {
      // QR: all squares in one filled path, so touching squares print solid (no hairline seams).
      out.push(setFillingGrayscaleColor(0));
      for (const [row, col, len] of op.runs) {
        out.push(
          rectangle(mm(op.x + col * op.module), mm(op.y + (op.n - 1 - row) * op.module), mm(len * op.module), mm(op.module)),
        );
      }
      out.push(fill());
    } else {
      // All bars as one filled path, each bar a whole number of printer dots wide.
      out.push(setFillingGrayscaleColor(0));
      for (const [dx, w] of op.bars) out.push(rectangle(mm(op.x + dx), mm(op.y), mm(w), mm(op.height)));
      out.push(fill());
    }
  }
  return out;
}

export async function renderTagsPdf(tags: TagData[], opts: RenderOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // subset:false embeds the whole font once; avoids glyph-mapping bugs in pdf-lib's subsetter.
  const fonts: Record<FontId, PDFFont> = {
    R: await doc.embedFont(opts.fonts.regular, { subset: false }),
    B: await doc.embedFont(opts.fonts.bold, { subset: false }),
  };
  const metrics = opts.metrics ?? createFontMetrics(opts.fonts);

  doc.setTitle(opts.title ?? `KSH tags (${opts.mode})`);
  doc.setCreator('KSH Tag Studio');
  doc.setProducer('KSH Tag Studio (pdf-lib)');

  const resources = doc.context.obj({ Font: { [FONT_RES.R]: fonts.R.ref, [FONT_RES.B]: fonts.B.ref } });
  const label = opts.label ?? DEFAULT_LABEL;
  const geometry = labelGeometry(label);
  const bbox = [0, 0, mm(geometry.w), mm(geometry.h)];
  // Identical tags (same object, e.g. copies of one row) share one XObject.
  const xobjects = new Map<TagData, PDFRef>();
  const xobjectFor = (tag: TagData): PDFRef => {
    let ref = xobjects.get(tag);
    if (!ref) {
      const stream = doc.context.formXObject(opsToPdf(layoutTag(tag, metrics, geometry).ops, fonts), {
        BBox: bbox,
        Resources: resources,
      });
      ref = doc.context.register(stream);
      xobjects.set(tag, ref);
    }
    return ref;
  };

  const [pw, ph] = pageSizePt(opts.mode, label);
  const rotate = opts.mode === 'print' && geometry.rotated;
  for (const tag of tags) {
    const page = doc.addPage([pw, ph]);
    const name = page.node.newXObject('Tag', xobjectFor(tag));
    page.pushOperators(
      pushGraphicsState(),
      // Design turned onto the label: x' = page width − y, y' = x  (translate, rotate +90°).
      ...(rotate ? [concatTransformationMatrix(0, 1, -1, 0, pw, 0)] : []),
      drawObject(name),
      popGraphicsState(),
    );
  }

  return doc.save();
}
