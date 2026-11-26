/**
 * Label sizes and orientation.
 *
 * A label is described the way Zebra rolls are sold: **width across the printer × length along
 * the feed** (the KSH roll is 75 × 125 mm). The tag design can be horizontal (long side across
 * the reader) or vertical. The print PDF page is always the label as it leaves the printer; when
 * the design and the page disagree, the design is turned 90° on the page (as docs/03 does for
 * the standard 125 × 75 tag on the 75 × 125 roll).
 */
import { MAX_BARCODE_MM } from '../barcode/code128';

export type Orientation = 'horizontal' | 'vertical';

export interface LabelSpec {
  /** Across the printhead (roll width), mm. */
  widthMm: number;
  /** Along the feed (label length), mm. */
  lengthMm: number;
  orientation: Orientation;
}

export interface LabelPreset {
  id: string;
  widthMm: number;
  lengthMm: number;
  note: string;
}

/** Sizes offered in the app. 75 × 125 is the current KSH roll. */
export const LABEL_PRESETS: readonly LabelPreset[] = [
  { id: '75x125', widthMm: 75, lengthMm: 125, note: 'Current KSH tag' },
  { id: '100x50', widthMm: 100, lengthMm: 50, note: 'Fits every current code' },
  { id: '51x32', widthMm: 51, lengthMm: 32, note: 'Small QR tag' },
];

export const DEFAULT_LABEL: LabelSpec = { widthMm: 75, lengthMm: 125, orientation: 'horizontal' };

/** Limits for a custom size. The GX430t prints at most 104 mm across. */
export const LABEL_LIMITS = { minMm: 20, maxWidthMm: 104, maxLengthMm: 300 } as const;

/** The exact docs/03 tag (125 × 75 design). */
const STANDARD = { w: 125, h: 75, margin: 6 } as const;

/** Below this short side the tag is the small QR tag (Classic design): a QR code instead of a line barcode. */
export const COMPACT_BELOW_MM = 40;

/** Line barcode (Code 128) on normal tags; QR code on small tags. */
export type Symbology = 'code128' | 'qr';

export interface TagGeometry {
  /** Design size as the tag is read (mm). */
  w: number;
  h: number;
  /** Print page size (mm): the label as it leaves the printer. */
  pageW: number;
  pageH: number;
  /** The design is turned 90° on the print page. */
  rotated: boolean;
  /** The exact docs/03 KSH layout (125 × 75). */
  standard: boolean;
  /** Small tag (short side < 40 mm): the Classic QR tag. */
  compact: boolean;
  /** Which code is printed: line barcode or QR. */
  symbology: Symbology;
  /** Most room for the QR side (mm) on small tags; 0 on line-barcode tags. */
  qrRoomMm: number;
  /** Side margin (mm). */
  marginMm: number;
  /** Most room the barcode may take, quiet zones included (mm). */
  barcodeRoomMm: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function labelGeometry(label: LabelSpec = DEFAULT_LABEL): TagGeometry {
  const long = Math.max(label.widthMm, label.lengthMm);
  const short = Math.min(label.widthMm, label.lengthMm);
  const [w, h] = label.orientation === 'horizontal' ? [long, short] : [short, long];
  const standard = w === STANDARD.w && h === STANDARD.h;
  const marginMm = standard ? STANDARD.margin : Math.min(6, Math.max(2, round1(w * 0.048)));
  const compact = !standard && short < COMPACT_BELOW_MM;
  // QR room: landscape = the band between the name and the code lines; portrait = the width.
  const qrRoomMm = !compact ? 0 : round1(w >= h ? Math.min(h - 16.5, w * 0.4) : Math.min(w - 8.8, h * 0.4));
  return {
    w,
    h,
    pageW: label.widthMm,
    pageH: label.lengthMm,
    rotated: w !== label.widthMm,
    standard,
    compact,
    symbology: compact ? 'qr' : 'code128',
    qrRoomMm,
    marginMm,
    barcodeRoomMm: standard ? MAX_BARCODE_MM : round1(w - 2 * marginMm),
  };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "51 × 32 mm" (width across the printer × length). */
export function labelName(label: LabelSpec): string {
  return `${fmt(label.widthMm)} × ${fmt(label.lengthMm)} mm`;
}

/** "51x32mm-vertical" for file names. */
export function labelFileTag(label: LabelSpec): string {
  return `${fmt(label.widthMm)}x${fmt(label.lengthMm)}mm${label.orientation === 'vertical' ? '-vertical' : ''}`;
}

export function isDefaultLabel(label: LabelSpec): boolean {
  return sameLabel(label, DEFAULT_LABEL);
}

export function sameLabel(a: LabelSpec, b: LabelSpec): boolean {
  return a.widthMm === b.widthMm && a.lengthMm === b.lengthMm && a.orientation === b.orientation;
}

export function presetFor(label: LabelSpec): LabelPreset | null {
  return LABEL_PRESETS.find((p) => p.widthMm === label.widthMm && p.lengthMm === label.lengthMm) ?? null;
}

/** Check a custom size. Returns a message for the person, or null when it is fine. */
export function checkCustomSize(widthMm: number, lengthMm: number): string | null {
  const { minMm, maxWidthMm, maxLengthMm } = LABEL_LIMITS;
  if (!Number.isFinite(widthMm) || !Number.isFinite(lengthMm)) return 'Type both sizes in mm.';
  if (widthMm < minMm || lengthMm < minMm) return `The smallest size is ${minMm} mm.`;
  if (widthMm > maxWidthMm) return `The printer prints at most ${maxWidthMm} mm across.`;
  if (lengthMm > maxLengthMm) return `The longest label allowed is ${maxLengthMm} mm.`;
  return null;
}

/** Parse a stored/typed label; null when it is not a usable label. */
export function parseLabel(value: unknown): LabelSpec | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const widthMm = Number(v.widthMm);
  const lengthMm = Number(v.lengthMm);
  const orientation = v.orientation === 'vertical' ? 'vertical' : v.orientation === 'horizontal' ? 'horizontal' : null;
  if (!orientation || checkCustomSize(widthMm, lengthMm)) return null;
  return { widthMm: round1(widthMm), lengthMm: round1(lengthMm), orientation };
}
