'use client';
import { PT_MM, type DrawOp } from '@/core/tags';

/**
 * Live tag preview: plays the same drawing instructions as the PDF renderer into an SVG
 * (units = mm, y flipped because the layout is measured from the bottom-left).
 */
export function TagPreview({
  ops,
  width,
  height,
  className,
}: {
  ops: DrawOp[];
  width: number;
  height: number;
  className?: string;
}) {
  const H = height;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
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
              letterSpacing={op.track ? op.track * PT_MM : undefined}
              textLength={op.width > 0 ? op.width : undefined}
              lengthAdjust={op.track ? 'spacing' : 'spacingAndGlyphs'}
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
        if (op.kind === 'matrix') {
          return (
            <g key={i} fill="#000" shapeRendering="crispEdges">
              {op.runs.map(([row, col, len], j) => (
                <rect
                  key={j}
                  x={op.x + col * op.module}
                  y={H - op.y - (op.n - row) * op.module}
                  width={len * op.module}
                  height={op.module}
                />
              ))}
            </g>
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
