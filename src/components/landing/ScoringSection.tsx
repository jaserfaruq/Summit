"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Score data                                                        */
/* ------------------------------------------------------------------ */

interface Score {
  label: string;
  tagline: string;
  current: number;
  target: number;
  color: string;
  delay: number;
}

const SCORES: Score[] = [
  { label: "Cardio", tagline: "8h loaded ascent", current: 62, target: 78, color: "#22c55e", delay: 0 },
  { label: "Strength", tagline: "700+ step-ups", current: 41, target: 85, color: "#eab308", delay: 120 },
  { label: "Climbing", tagline: "5.5 alpine snow", current: 18, target: 40, color: "#ef4444", delay: 240 },
  { label: "Flexibility", tagline: "deep hip openers", current: 55, target: 60, color: "#4ade80", delay: 360 },
];

/* ------------------------------------------------------------------ */
/*  useCountUp hook                                                   */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, duration: number): [number, React.RefObject<HTMLDivElement>] {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);
  const triggered = useRef(false);

  const animate = useCallback(() => {
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-quart: 1 - (1 - t)^4
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [target, duration]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setValue(target);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          animate();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, animate]);

  return [value, ref];
}

/* ------------------------------------------------------------------ */
/*  ArcCard                                                           */
/* ------------------------------------------------------------------ */

function ArcCard({ label, tagline, current, target, color, delay }: Score) {
  const [n, ref] = useCountUp(current, 900 + delay);
  const pct = target > 0 ? Math.min((n / target) * 100, 100) : 0;
  const r = 52;
  const C = 2 * Math.PI * r;
  const offset = C - (pct / 100) * C;

  return (
    <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-xl p-5 text-center">
      <div ref={ref} className="relative inline-block">
        <svg width="120" height="120" className="-rotate-90">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 100ms linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-[28px] text-white tabular-nums leading-none">
            {n}
          </span>
          <span className="text-[11px] text-dark-muted mt-0.5">/ {target}</span>
        </div>
      </div>
      <div className="mt-3 font-semibold text-[15px] text-white">{label}</div>
      <div className="text-xs text-dark-muted italic mt-0.5">{tagline}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ScoringSection                                                    */
/* ------------------------------------------------------------------ */

export default function ScoringSection() {
  return (
    <section id="scoring" className="relative py-20 md:py-28">
      <div className="absolute inset-0 -z-10 bg-dark-bg" />

      <div className="relative max-w-7xl mx-auto px-8 md:px-14">
        {/* Header */}
        <p className="text-burnt-orange text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
          FOUR DIMENSIONS &middot; ONE READINESS
        </p>
        <h2 className="font-display font-bold text-white text-3xl md:text-4xl tracking-tight leading-[1.1] mb-3">
          Scored across cardio, strength, climbing, and flexibility.
        </h2>
        <p className="text-white/60 text-[15px] leading-relaxed max-w-2xl mb-10">
          Every objective sets a target in each dimension. Your current score is
          calibrated by an assessment, then nudged weekly by what you actually
          train. The gap is the work.
        </p>

        {/* Arc cards grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {SCORES.map((s) => (
            <ArcCard key={s.label} {...s} />
          ))}
        </div>

        {/* AI Assessment Note */}
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-xl p-7 border-l-[3px] border-l-burnt-orange">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-[10px] font-bold text-burnt-orange uppercase tracking-[0.3em]">
              AI ASSESSMENT NOTE
            </span>
            <span className="text-[11px] text-dark-muted">
              Strength &middot; 41/85
            </span>
          </div>
          <p className="text-[17px] leading-relaxed text-white/85">
            <span className="text-white font-semibold">
              Your 405&nbsp;lb squat shows raw power
            </span>{" "}
            but the graduation benchmark is 12 rounds of leg blasters, which
            tests muscular endurance, not max load.
            <span className="text-white/55">
              {" "}
              Key factor: untested for repeated submaximal work under load.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
