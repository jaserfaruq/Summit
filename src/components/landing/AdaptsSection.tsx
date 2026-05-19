"use client";

import { useState, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const WORKOUTS = [
  {
    dim: "Strength",
    dimColor: "#eab308",
    day: "Tuesday",
    title: "Loaded step-up intervals",
    meta: "60 min \u00b7 35 lb pack",
    exercises: [
      "Loaded step-ups \u2014 4 \u00d7 12 each leg, 18in box",
      "Walking lunges \u2014 3 \u00d7 20 each leg, 35 lb pack",
      "Box jumps \u2014 3 \u00d7 15",
      "Core circuit \u2014 planks, dead bugs, pallof press \u00d7 3 rounds",
    ],
    reasoning: {
      1: {
        credit: "20%",
        tone: "#ef4444",
        note: "Session incomplete. Strength score holds \u2014 we\u2019ll reduce load next week and rebuild the ramp.",
      },
      2: {
        credit: "55%",
        tone: "#eab308",
        note: "Below target reps on step-ups. Partial credit; we\u2019ll hold volume and retest next week.",
      },
      3: {
        credit: "100%",
        tone: "#22c55e",
        note: "Full session at prescribed load. Strength moves toward graduation benchmark on schedule.",
      },
      4: {
        credit: "115%",
        tone: "#22c55e",
        note: "Exceeded prescribed reps. Bumping next session\u2019s load by 5 lb to keep the ramp honest.",
      },
      5: {
        credit: "130%",
        tone: "#4ade80",
        note: "Crushed it. Step-up cadence is ahead of plan \u2014 jumping to week 7 loading next session.",
      },
    },
    score: { from: 41 },
  },
  {
    dim: "Cardio",
    dimColor: "#22c55e",
    day: "Thursday",
    title: "Long zone-2 trail run",
    meta: "90 min \u00b7 rolling terrain",
    exercises: [
      "Trail run \u2014 10 mi, 1,800 ft gain",
      "Target HR 135\u2013145 bpm (zone 2)",
      "Nasal breathing for first 60 min",
      "Final 2 mi at marathon effort",
    ],
    reasoning: {
      1: {
        credit: "20%",
        tone: "#ef4444",
        note: "Bailed early \u2014 only 4 mi logged. Cardio score nudged down. Scheduling a shorter make-up run Saturday.",
      },
      2: {
        credit: "55%",
        tone: "#eab308",
        note: "HR drifted into zone 3 for most of the run. Aerobic base work needs to stay easy \u2014 credit reduced.",
      },
      3: {
        credit: "100%",
        tone: "#22c55e",
        note: "Clean zone-2 session, full distance. Cardio trends toward the 8h loaded ascent target.",
      },
      4: {
        credit: "115%",
        tone: "#22c55e",
        note: "Finished strong with negative splits. Extending next long run to 12 mi to match the trajectory.",
      },
      5: {
        credit: "130%",
        tone: "#4ade80",
        note: "Sub-1:40 with 2,000 ft gain \u2014 you\u2019re touching graduation-level pacing. Next test week moves up.",
      },
    },
    score: { from: 62 },
  },
  {
    dim: "Climbing",
    dimColor: "#ef4444",
    day: "Saturday",
    title: "Glacier skills clinic",
    meta: "3 hours \u00b7 guided session",
    exercises: [
      "Crampon technique \u2014 flat, ascending, descending (40 min)",
      "Self-arrest drills \u2014 head-first, feet-first \u00d7 8 each (30 min)",
      "Roped team travel simulation (60 min)",
      "Crevasse rescue haul system practice (30 min)",
    ],
    reasoning: {
      1: {
        credit: "20%",
        tone: "#ef4444",
        note: "Technique still rough \u2014 self-arrests didn\u2019t stick under fatigue. Scheduling a second clinic before test week.",
      },
      2: {
        credit: "55%",
        tone: "#eab308",
        note: "Crampon work was solid but rope handling needs repetition. Partial credit toward climbing.",
      },
      3: {
        credit: "100%",
        tone: "#22c55e",
        note: "All four drills completed cleanly. Climbing score jumps \u2014 this was the biggest gap in the plan.",
      },
      4: {
        credit: "115%",
        tone: "#22c55e",
        note: "Guide noted you\u2019re moving efficiently on the rope. Advancing to a longer simulated glacier day.",
      },
      5: {
        credit: "130%",
        tone: "#4ade80",
        note: "Self-arrests are automatic. Crevasse rescue under 4 min. Climbing is no longer the weakest dimension.",
      },
    },
    score: { from: 18 },
  },
  {
    dim: "Flexibility",
    dimColor: "#4ade80",
    day: "Sunday",
    title: "Mobility & hip openers",
    meta: "45 min \u00b7 recovery day",
    exercises: [
      "Hip opener flow \u2014 90/90, pigeon, frog (15 min)",
      "Couch stretch \u2014 2 min per side",
      "Pancake forward fold progression (10 min)",
      "Ankle dorsiflexion work \u2014 wall slides \u00d7 3 min/side",
    ],
    reasoning: {
      1: {
        credit: "20%",
        tone: "#ef4444",
        note: "Skipped most of the session. Flexibility is close to target \u2014 but regression is fast. Keeping the slot.",
      },
      2: {
        credit: "55%",
        tone: "#eab308",
        note: "Rushed through. Hip openers need time under stretch, not just reps. Half credit.",
      },
      3: {
        credit: "100%",
        tone: "#22c55e",
        note: "Full session, held positions. Flexibility is nearly at target \u2014 maintaining from here.",
      },
      4: {
        credit: "115%",
        tone: "#22c55e",
        note: "Good depth on pancake fold. You\u2019re at target \u2014 shifting this slot toward active recovery next week.",
      },
      5: {
        credit: "130%",
        tone: "#4ade80",
        note: "Couch stretch is easy at 2 min. Flexibility graduated \u2014 dropping to maintenance frequency.",
      },
    },
    score: { from: 55 },
  },
];

const RATING_LABELS: Record<number, string> = {
  1: "Couldn\u2019t complete the work.",
  2: "Pretty far off today.",
  3: "Did exactly what was prescribed.",
  4: "Felt stronger than the prescription.",
  5: "Crushed it \u2014 could have done more.",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdaptsSection() {
  const [wi, setWi] = useState(0);
  const [rating, setRating] = useState(3);
  const [paused, setPaused] = useState(false);

  /* Auto-advance carousel every 5 s */
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setWi((prev) => (prev + 1) % WORKOUTS.length);
      setRating(3);
    }, 5000);
    return () => clearInterval(timer);
  }, [paused]);

  const w = WORKOUTS[wi];
  const r = w.reasoning[rating as keyof typeof w.reasoning];
  const creditNum = parseInt(r.credit);
  const delta = Math.round((creditNum - 100) / 10);
  const scoreTo = w.score.from + delta;

  return (
    <section id="adapts" className="relative py-20 md:py-28">
      <div className="absolute inset-0 -z-10 bg-[rgba(14,18,16,0.88)]" />

      <div className="relative max-w-7xl mx-auto px-8 md:px-14">
        {/* Section header */}
        <p className="text-burnt-orange text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
          ADAPTS WEEKLY
        </p>
        <h2 className="font-display font-bold text-white text-3xl md:text-4xl tracking-tight leading-[1.1] mb-3">
          One tap after every session. The plan takes it from there.
        </h2>
        <p className="text-white/60 text-[15px] leading-relaxed max-w-2xl mb-10">
          Rate it 1 to 5 &mdash; add a comment if you want. Summit figures out
          what actually trained the right dimension, updates your readiness
          scores, and rewrites the plan if needed. Crushing strength but behind
          on climbing? Next week shifts accordingly.
        </p>

        {/* Two-column grid */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* ---- LEFT: Workout card ---- */}
          <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-xl p-6 flex flex-col">
            {/* Dimension tabs */}
            <div className="flex gap-1 mb-6">
              {WORKOUTS.map((wk, i) => (
                <button
                  key={wk.dim}
                  onClick={() => {
                    setWi(i);
                    setRating(3);
                  }}
                  className="btn-press flex-1 text-[11px] font-bold uppercase tracking-[0.15em] py-2 rounded-md transition-all duration-150"
                  style={{
                    color: i === wi ? wk.dimColor : "rgba(122,143,130,0.7)",
                    background:
                      i === wi
                        ? `${wk.dimColor}12`
                        : "transparent",
                    borderBottom:
                      i === wi
                        ? `2px solid ${wk.dimColor}`
                        : "2px solid transparent",
                  }}
                >
                  {wk.dim}
                </button>
              ))}
            </div>

            {/* Workout content */}
            <div className="flex-1">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1"
                style={{ color: w.dimColor }}
              >
                {w.day}
              </div>
              <div className="text-dark-muted text-[13px] mb-2">{w.meta}</div>
              <h3 className="font-display font-bold text-[26px] text-white leading-tight mb-5">
                {w.title}
              </h3>

              <ol className="space-y-2.5">
                {w.exercises.map((ex, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                      style={{
                        background: `${w.dimColor}20`,
                        color: w.dimColor,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-white/80 text-[14px] leading-snug">
                      {ex}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Rating picker */}
            <div className="mt-6 pt-5 border-t border-dark-border/50">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 mb-3">
                HOW DID IT GO?
              </div>
              <div className="flex gap-2 mb-2">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className="btn-press w-8 h-8 rounded-md border font-semibold text-[13px] transition-all duration-150"
                    style={{
                      borderColor:
                        n === rating
                          ? "#D4782F"
                          : "rgba(45,59,51,0.6)",
                      background:
                        n === rating
                          ? "rgba(212,120,47,0.18)"
                          : "rgba(23,29,26,0.6)",
                      color:
                        n === rating ? "#D4782F" : "#7a8f82",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-dark-muted text-[13px] leading-snug">
                {RATING_LABELS[rating]}
              </p>
            </div>
          </div>

          {/* ---- RIGHT: Score movement + AI eval ---- */}
          <div
            className="bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-xl p-6 flex flex-col"
            style={{ borderLeft: `3px solid ${w.dimColor}` }}
          >
            {/* Dimension eyebrow */}
            <div
              className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4"
              style={{ color: w.dimColor }}
            >
              {w.dim} Score Movement
            </div>

            {/* Big score numbers */}
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-display font-bold text-[48px] text-white tabular-nums leading-none">
                {w.score.from}
              </span>
              <span className="text-dark-muted text-xl">&rarr;</span>
              <span
                className="font-display font-bold text-[48px] tabular-nums leading-none"
                style={{ color: r.tone }}
              >
                {scoreTo}
              </span>
            </div>

            {/* Credit text */}
            <div className="flex items-baseline gap-2 mb-6">
              <span
                className="text-[15px] font-semibold tabular-nums"
                style={{ color: r.tone }}
              >
                {r.credit} credit
              </span>
              <span className="text-dark-muted text-[13px]">
                {delta > 0 && "+"}
                {delta} points
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-dark-border/50 mb-5" />

            {/* AI Relevance eval */}
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 mb-3">
                AI RELEVANCE EVAL
              </div>
              <p className="text-white/80 text-[15px] leading-relaxed">
                {r.note}
              </p>
            </div>

            {/* Carousel dots */}
            <div className="flex justify-center gap-2 mt-6 pt-4 border-t border-dark-border/50">
              {WORKOUTS.map((wk, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setWi(i);
                    setRating(3);
                  }}
                  className="h-2 rounded-full transition-all duration-200"
                  style={{
                    width: i === wi ? 24 : 8,
                    background:
                      i === wi
                        ? wk.dimColor
                        : "rgba(255,255,255,0.15)",
                  }}
                  aria-label={`Show ${wk.dim} workout`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
