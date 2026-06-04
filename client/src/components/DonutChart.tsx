import { useMemo } from "react";

export interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

const GAP_DEG = 3;
const MIN_FRAC = 0.03;

export function DonutChart({ segments, size = 80, strokeWidth = 12, children }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const arcs = useMemo(() => {
    const visible = segments.filter(s => s.value > 0);
    const total = visible.reduce((a, s) => a + s.value, 0);
    if (total === 0 || visible.length === 0) return [];

    let fracs = visible.map(s => s.value / total);
    const hasSmall = fracs.some(f => f < MIN_FRAC);
    if (hasSmall) {
      fracs = fracs.map(f => Math.max(f, MIN_FRAC));
      const sum = fracs.reduce((a, b) => a + b, 0);
      fracs = fracs.map(f => f / sum);
    }

    const gapFrac = visible.length >= 2 ? GAP_DEG / 360 : 0;
    const totalGapFrac = gapFrac * visible.length;
    const drawFracs = fracs.map(f => f * (1 - totalGapFrac));

    let offset = 0;
    return visible.map((seg, i) => {
      const frac = drawFracs[i];
      const dashLen = frac * circumference;
      const dashOffset = -offset * circumference;
      offset += frac + gapFrac;
      return { seg, dashLen, dashOffset };
    });
  }, [segments, circumference]);

  const isEmpty = arcs.length === 0;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted/30"
          strokeWidth={strokeWidth}
        />
        {isEmpty && (
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/30"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * 0.96} ${circumference * 0.04}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
        )}
        {arcs.map(({ seg, dashLen, dashOffset }, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={dashOffset}
          />
        ))}
      </svg>
      {children && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children}
        </div>
      )}
    </div>
  );
}
