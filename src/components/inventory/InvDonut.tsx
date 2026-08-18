interface DonutSegment {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
}

interface InvDonutProps {
  segments: DonutSegment[];
}

export function InvDonut({ segments }: InvDonutProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const cx = 66;
  const cy = 66;

  let cumulativePercent = 0;
  const arcs = segments.map((segment) => {
    const fraction = segment.value / total;
    const dashArray = `${fraction * circumference} ${circumference}`;
    const dashOffset = circumference * (1 - cumulativePercent);
    cumulativePercent += fraction;
    return { ...segment, dashArray, dashOffset };
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-inv-line)" strokeWidth="14" />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth="14"
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className={arc.onClick ? "cursor-pointer" : ""}
            onClick={arc.onClick}
          />
        ))}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontFamily="Georgia,serif"
          fontSize="18"
          fontWeight="700"
          fill="var(--color-inv-ink)"
        >
          {new Intl.NumberFormat("en-IN").format(total)}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8.5" letterSpacing="1" fill="var(--color-inv-mut)">
          TOTAL
        </text>
      </svg>

      <div className="flex flex-col gap-2 text-[12.5px]">
        {segments.map((segment, i) => (
          <div
            key={i}
            onClick={segment.onClick}
            className={`flex items-center ${segment.onClick ? "cursor-pointer hover:text-inv-gold" : ""}`}
          >
            <span
              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: segment.color }}
            />
            {segment.label}
            <b className="ml-1.5 font-semibold" style={{ fontFamily: "var(--font-serif-display)" }}>
              {new Intl.NumberFormat("en-IN").format(segment.value)}
            </b>
            <span className="ml-2 text-inv-mut">{((segment.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
