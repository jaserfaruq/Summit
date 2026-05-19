const DIMENSIONS = [
  {
    key: "cardio",
    label: "Cardio",
    color: "#22c55e",
    current: 62,
    target: 78,
    benchmark: "10 mi trail run w/ 2,000 ft gain",
    series: [32, 36, 41, 38, 47, 52, 58, 63, 68, 70, 73, 76],
  },
  {
    key: "strength",
    label: "Strength",
    color: "#eab308",
    current: 41,
    target: 85,
    benchmark: "12 rounds of leg blasters",
    series: [18, 22, 26, 24, 30, 36, 44, 52, 50, 60, 68, 76],
  },
  {
    key: "climbing",
    label: "Climbing",
    color: "#ef4444",
    current: 18,
    target: 40,
    benchmark: "8h continuous glacier travel",
    series: [5, 7, 10, 9, 12, 15, 18, 22, 21, 26, 32, 38],
  },
  {
    key: "flexibility",
    label: "Flexibility",
    color: "#4ade80",
    current: 55,
    target: 60,
    benchmark: "2 min couch stretch per side",
    series: [40, 42, 44, 43, 46, 48, 50, 52, 51, 54, 56, 58],
  },
];

const WEEK_TYPES = [
  "regular",
  "test",
  "regular",
  "recovery",
  "regular",
  "test",
  "regular",
  "regular",
  "recovery",
  "regular",
  "taper",
  "taper",
];

const WEEK_TYPE_COLORS: Record<string, string> = {
  regular: "transparent",
  test: "rgba(26,82,118,0.18)",
  recovery: "rgba(139,157,131,0.14)",
  taper: "rgba(245,127,23,0.14)",
};

/* ---- SVG layout constants ---- */
const W = 560;
const H = 200;
const padL = 36;
const padR = 16;
const padT = 16;
const padB = 28;
const innerW = W - padL - padR; // 508
const innerH = H - padT - padB; // 156

function Swatch({
  color,
  border,
  label,
}: {
  color: string;
  border?: boolean;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block w-[14px] h-[14px] rounded-[3px] shrink-0"
        style={{
          background: color,
          border: border ? "1px solid rgba(255,255,255,0.2)" : "none",
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function DimensionChart({
  d,
}: {
  d: (typeof DIMENSIONS)[number];
}) {
  const yMax = Math.max(d.target, ...d.series) * 1.08;
  const count = d.series.length;

  /* Map data points to SVG coords */
  const points = d.series.map((v, i) => ({
    x: padL + (i / (count - 1)) * innerW,
    y: padT + (1 - v / yMax) * innerH,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  /* Area fill path: line across top, then down right edge, across bottom, up left edge */
  const areaPath = [
    `M ${points[0].x},${points[0].y}`,
    ...points.slice(1).map((p) => `L ${p.x},${p.y}`),
    `L ${points[count - 1].x},${padT + innerH}`,
    `L ${points[0].x},${padT + innerH}`,
    "Z",
  ].join(" ");

  /* Graduation target Y */
  const targetY = padT + (1 - d.target / yMax) * innerH;

  /* Grid lines (5 evenly spaced) */
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const frac = i / 4;
    return padT + frac * innerH;
  });

  /* Y-axis labels */
  const yTop = Math.round(yMax);
  const yBot = 0;

  /* X-axis week labels */
  const xLabels = [
    { label: "W1", idx: 0 },
    { label: "W4", idx: 3 },
    { label: "W7", idx: 6 },
    { label: "W10", idx: 9 },
    { label: "W12", idx: 11 },
  ];

  /* Week-type bands */
  const bandW = innerW / count;

  const gradientId = `area-grad-${d.key}`;
  const pulseId = `pulse-${d.key}`;
  const last = points[count - 1];

  return (
    <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div
            className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1.5"
            style={{ color: d.color }}
          >
            {d.label}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-[34px] text-white tabular-nums leading-none">
              {d.current}
            </span>
            <span className="text-dark-muted text-[13px]">now</span>
            <span className="text-dark-muted text-base mx-1">&rarr;</span>
            <span className="font-display font-bold text-[22px] text-burnt-orange tabular-nums">
              {d.target}
            </span>
            <span className="text-dark-muted text-[13px]">target</span>
          </div>
        </div>
        <div className="text-right max-w-[200px]">
          <div className="text-[10px] text-white/50 uppercase tracking-[0.18em] mb-1 font-semibold">
            Graduation
          </div>
          <div className="text-xs text-white/75 leading-snug">
            {d.benchmark}
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="30%" stopColor={d.color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={d.color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Week-type background bands */}
        {WEEK_TYPES.map((wt, i) => {
          if (wt === "regular") return null;
          const bx = padL + i * bandW;
          return (
            <rect
              key={`band-${d.key}-${i}`}
              x={bx}
              y={padT}
              width={bandW}
              height={innerH}
              fill={WEEK_TYPE_COLORS[wt]}
              rx={2}
            />
          );
        })}

        {/* Horizontal grid lines */}
        {gridLines.map((gy, i) => (
          <line
            key={`grid-${d.key}-${i}`}
            x1={padL}
            y1={gy}
            x2={padL + innerW}
            y2={gy}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}

        {/* Graduation target dashed line */}
        <line
          x1={padL}
          y1={targetY}
          x2={padL + innerW}
          y2={targetY}
          stroke="rgba(212,120,47,0.55)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={padL + innerW - 2}
          y={targetY - 5}
          textAnchor="end"
          fill="rgba(212,120,47,0.7)"
          fontSize={9}
          fontWeight={600}
        >
          TARGET {d.target}
        </text>

        {/* Y-axis labels */}
        <text
          x={padL - 6}
          y={padT + 4}
          textAnchor="end"
          fill="rgba(255,255,255,0.3)"
          fontSize={9}
        >
          {yTop}
        </text>
        <text
          x={padL - 6}
          y={padT + innerH + 1}
          textAnchor="end"
          fill="rgba(255,255,255,0.3)"
          fontSize={9}
        >
          {yBot}
        </text>

        {/* X-axis week labels */}
        {xLabels.map(({ label, idx }) => {
          const lx = padL + (idx / (count - 1)) * innerW;
          return (
            <text
              key={`xl-${d.key}-${idx}`}
              x={lx}
              y={H - 6}
              textAnchor="middle"
              fill="rgba(255,255,255,0.3)"
              fontSize={9}
            >
              {label}
            </text>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Trajectory polyline */}
        <polyline
          points={polyline}
          fill="none"
          stroke={d.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data point dots */}
        {points.map((p, i) => (
          <circle
            key={`dot-${d.key}-${i}`}
            cx={p.x}
            cy={p.y}
            r={i === count - 1 ? 4 : 2.5}
            fill={d.color}
          />
        ))}

        {/* Pulsing circle at last point */}
        <circle
          id={pulseId}
          cx={last.x}
          cy={last.y}
          r={4}
          fill="none"
          stroke={d.color}
          strokeWidth={1.5}
          opacity={0}
        >
          <animate
            attributeName="r"
            values="4;12"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}

export default function PlanChartsSection() {
  return (
    <section id="plan" className="relative py-20 md:py-28">
      <div className="absolute inset-0 -z-10 bg-dark-bg" />

      <div className="relative max-w-7xl mx-auto px-8 md:px-14">
        {/* Section header */}
        <p className="text-burnt-orange text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
          THE PLAN
        </p>
        <h2 className="font-display font-bold text-white text-3xl md:text-4xl tracking-tight leading-[1.1] mb-3">
          Every dimension on its own line, climbing toward its graduation target.
        </h2>
        <p className="text-white/60 text-[15px] leading-relaxed max-w-2xl mb-10">
          Twelve weeks. Regular weeks build. Test weeks calibrate. Recovery weeks
          deload. Taper weeks lock your scores before summit day. Each chart is
          what you&apos;ll see on your dashboard, every week.
        </p>

        {/* Chart grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DIMENSIONS.map((d) => (
            <DimensionChart key={d.key} d={d} />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-5 mt-6 text-xs text-white/70 justify-center">
          <Swatch color="transparent" border label="Regular — progressive load" />
          <Swatch
            color="rgba(26,82,118,0.4)"
            label="Test — benchmark calibration"
          />
          <Swatch
            color="rgba(139,157,131,0.35)"
            label="Recovery — deload"
          />
          <Swatch
            color="rgba(245,127,23,0.35)"
            label="Taper — sharpen, then summit"
          />
        </div>
      </div>
    </section>
  );
}
