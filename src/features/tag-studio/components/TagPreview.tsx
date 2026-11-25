'use client';
import { DESIGN_H_MM, DESIGN_W_MM, PT_MM, type DrawOp } from '@/core/tags';

/**
 * Live tag preview: plays the same drawing instructions as the PDF renderer into an SVG
 * (units = mm, y flipped because the layout is measured from the bottom-left).
 */
export function TagPreview({ ops, className }: { ops: DrawOp[]; className?: string }) {
  const H = DESIGN_H_MM;
  return (
    <svg
      viewBox={`0 0 ${DESIGN_W_MM} ${DESIGN_H_MM}`}
      className={`tag-svg block w-full bg-white ${className ?? ''}`}
      role="img"
      aria-label="Tag preview"
      textRendering="geometricPrecision"
    >
      {ops.map((op, i) => {
        if (op.kind === 'text') {
          const g = Math.round(op.gray * 255);
          return (
            <text
              key={i}
              x={op.x}
              y={H - op.y}
              fontSize={op.size * PT_MM}
              fontWeight={op.font === 'B' ? 700 : 400}
              fill={`rgb(${g},${g},${g})`}
              textLength={op.width > 0 ? op.width : undefined}
              lengthAdjust="spacingAndGlyphs"
              style={{ whiteSpace: 'pre' }}
            >
              {op.text}
            </text>
          );
        }
        if (op.kind === 'line') {
          return (
            <line key={i} x1={op.x1} y1={H - op.y1} x2={op.x2} y2={H - op.y2} stroke="#000" strokeWidth={op.widthPt * PT_MM} />
          );
        }
        return (
          <g key={i} fill="#000" shapeRendering="crispEdges">
            {op.bars.map(([dx, w], j) => (
              <rect key={j} x={op.x + dx} y={H - op.y - op.height} width={w} height={op.height} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
