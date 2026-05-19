const BENCHMARKS = [
  {
    dim: "STRENGTH",
    big: "700",
    unit: "loaded step-ups",
    sub: "@ 35 lb in 30 min",
    color: "text-yellow-500",
  },
  {
    dim: "STRENGTH",
    big: "12",
    unit: "rounds of leg blasters",
    sub: "20 squats, 20 lunges, 20 jumps",
    color: "text-yellow-500",
  },
  {
    dim: "CARDIO",
    big: "10",
    unit: "mi trail run",
    sub: "2,000 ft gain, sub 1:40",
    color: "text-green-500",
  },
  {
    dim: "CARDIO",
    big: "6",
    unit: "mi loaded pack hike",
    sub: "35 lb, 2:15",
    color: "text-green-500",
  },
  {
    dim: "CLIMBING",
    big: "8h",
    unit: "roped glacier travel",
    sub: "continuous, self-arrest drills",
    color: "text-red-500",
  },
  {
    dim: "FLEXIBILITY",
    big: "2:00",
    unit: "couch stretch per side",
    sub: "shoulders square, easy breath",
    color: "text-emerald-400",
  },
];

export default function GraduationSection() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[rgba(14,18,16,0.82)] to-[rgba(14,18,16,0.95)]" />

      <div className="relative max-w-7xl mx-auto px-8 md:px-14">
        <p className="text-burnt-orange text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
          GRADUATION WORKOUTS
        </p>
        <h2 className="font-display font-bold text-white text-3xl md:text-4xl tracking-tight leading-[1.1] mb-3">
          More than ready. That&apos;s the whole point.
        </h2>
        <p className="text-white/60 text-[15px] leading-relaxed max-w-2xl mb-10">
          Every plan builds toward a graduation workout set above what the
          mountain actually requires. Hit the benchmark, and summit day is the
          easier version of something you&apos;ve already done.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENCHMARKS.map((b, i) => (
            <div
              key={`${b.dim}-${i}`}
              className="bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-xl p-6 flex flex-col justify-between gap-7 h-full"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-bold uppercase tracking-[0.3em] ${b.color}`}
                >
                  {b.dim}
                </span>
                <span className="text-[11px] text-dark-muted tabular-nums">
                  0{i + 1}
                </span>
              </div>
              <div>
                <div className="font-display font-bold text-[80px] leading-[0.9] text-white tracking-tight tabular-nums mb-2">
                  {b.big}
                </div>
                <div className="text-[16px] text-white/85 font-medium leading-tight">
                  {b.unit}
                </div>
                <div className="text-[13px] text-dark-muted mt-1.5 leading-relaxed">
                  {b.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
