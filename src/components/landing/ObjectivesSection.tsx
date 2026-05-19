function TierBadge({ tier }: { tier: "gold" | "silver" | "bronze" }) {
  const colors = {
    gold: "bg-medal-gold/20 text-medal-gold border-medal-gold/40",
    silver: "bg-white/10 text-white/80 border-white/20",
    bronze: "bg-burnt-orange/15 text-burnt-orange border-burnt-orange/30",
  };
  return (
    <span
      className={`relative inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.12em] border ${colors[tier]}`}
    >
      {tier === "gold" && (
        <span className="absolute inset-0 rounded tier-gold-shimmer" />
      )}
      <span className="relative">
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    </span>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-dark-muted text-[10px] uppercase tracking-[0.12em] mb-0.5">
        {label}
      </div>
      <div className="text-dark-text font-medium text-xs tabular-nums">
        {value}
      </div>
    </div>
  );
}

function LegendItem({
  tier,
  text,
}: {
  tier: "gold" | "silver" | "bronze";
  text: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <TierBadge tier={tier} />
      <span>{text}</span>
    </div>
  );
}

const OBJECTIVES = [
  {
    name: "Mont Blanc",
    route: "Gouter Route",
    tier: "gold" as const,
    summit: "15,780 ft",
    gain: "11,500 ft",
    grade: "PD",
    type: "Alpine mountaineering",
    season: "Jul \u2013 Sep",
  },
  {
    name: "Half Dome",
    route: "Cables + sub-dome",
    tier: "gold" as const,
    summit: "8,839 ft",
    gain: "4,800 ft",
    grade: "Class 3",
    type: "Big day hike",
    season: "May \u2013 Oct",
  },
  {
    name: "Denali",
    route: "West Buttress",
    tier: "gold" as const,
    summit: "20,310 ft",
    gain: "13,000 ft",
    grade: "AD",
    type: "Expedition",
    season: "May \u2013 Jul",
  },
  {
    name: "Mt. Rainier",
    route: "Disappointment Cleaver",
    tier: "silver" as const,
    summit: "14,411 ft",
    gain: "9,000 ft",
    grade: "PD",
    type: "Glacier travel",
    season: "Jun \u2013 Sep",
  },
  {
    name: "Mt. Whitney",
    route: "Mountaineer\u2019s Route",
    tier: "silver" as const,
    summit: "14,505 ft",
    gain: "6,100 ft",
    grade: "Class 3",
    type: "Scramble",
    season: "Jun \u2013 Oct",
  },
  {
    name: "Wonderland Trail",
    route: "93 mi loop",
    tier: "bronze" as const,
    summit: "\u2014",
    gain: "22,000 ft",
    grade: "\u2014",
    type: "Trail ultra",
    season: "Jul \u2013 Sep",
  },
];

function cardGradient(type: string): string {
  if (type.toLowerCase().includes("mountaineering"))
    return "from-forest/40 to-dark-bg";
  if (type.toLowerCase().includes("hike")) return "from-hiking-green/30 to-dark-bg";
  if (
    type.toLowerCase().includes("glacier") ||
    type.toLowerCase().includes("expedition")
  )
    return "from-test-blue/30 to-dark-bg";
  if (type.toLowerCase().includes("trail") || type.toLowerCase().includes("ultra"))
    return "from-sage/30 to-dark-bg";
  if (type.toLowerCase().includes("scramble"))
    return "from-dark-muted/30 to-dark-bg";
  return "from-dark-muted/30 to-dark-bg";
}

export default function ObjectivesSection() {
  return (
    <section id="objectives" className="relative py-20 md:py-28">
      <div className="absolute inset-0 -z-10 bg-[rgba(14,18,16,0.88)]" />

      <div className="relative max-w-7xl mx-auto px-8 md:px-14">
        <p className="text-burnt-orange text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
          VALIDATED OBJECTIVES
        </p>
        <h2 className="font-display font-bold text-white text-3xl md:text-4xl tracking-tight leading-[1.1] mb-3">
          The mountain you&apos;re training for is already in the library.
        </h2>
        <p className="text-white/60 text-[15px] leading-relaxed max-w-2xl mb-10">
          Gold-tier routes have curated targets and benchmarks set by our
          training team. Silver and Bronze are AI-calibrated against the closest
          validated objective. Pick yours &mdash; or describe a novel one and
          Summit will anchor it.
        </p>

        <div
          className="landing-lane flex gap-4 overflow-x-auto pb-4 -mx-8 px-8 md:-mx-14 md:px-14 snap-x snap-mandatory"
        >
          {OBJECTIVES.map((obj) => (
            <div
              key={obj.name}
              className="min-w-[280px] max-w-[280px] flex-shrink-0 snap-start bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-xl overflow-hidden"
            >
              {/* Card image header */}
              <div
                className={`relative h-[132px] bg-gradient-to-b ${cardGradient(obj.type)}`}
              >
                <div className="absolute top-3 left-3">
                  <TierBadge tier={obj.tier} />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="font-display font-bold text-white text-lg leading-tight">
                    {obj.name}
                  </div>
                  <div className="text-white/50 text-[11px] mt-0.5">
                    {obj.route}
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Spec label="Summit" value={obj.summit} />
                  <Spec label="Gain" value={obj.gain} />
                  <Spec label="Grade" value={obj.grade} />
                  <Spec label="Season" value={obj.season} />
                </div>
                <div className="text-[11px] text-dark-muted uppercase tracking-[0.08em]">
                  {obj.type}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-6 mt-8 text-xs text-white/60">
          <LegendItem
            tier="gold"
            text="Curated targets \u00B7 benchmarks validated by our team"
          />
          <LegendItem
            tier="silver"
            text="Targets calibrated against a Gold neighbor"
          />
          <LegendItem
            tier="bronze"
            text="AI-generated targets anchored to a similar route"
          />
        </div>
      </div>
    </section>
  );
}
