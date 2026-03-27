"use client";

import { useState } from "react";
import { PartnerSession } from "@/lib/types";

const DIMENSION_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  climbing_technical: "Climbing",
  flexibility: "Flexibility",
};

const DIMENSION_COLORS: Record<string, string> = {
  cardio: "bg-test-blue/20 text-test-blue",
  strength: "bg-burnt-orange/20 text-burnt-orange",
  climbing_technical: "bg-sage/20 text-sage",
  flexibility: "bg-hiking-green/20 text-hiking-green",
};

export default function PartnerSessionCard({
  session,
  isMatched,
  matchReason,
}: {
  session: PartnerSession;
  isMatched: boolean;
  matchReason?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const full = session.fullSession;

  return (
    <div
      className={`bg-dark-surface border rounded-lg transition-all ${
        isMatched
          ? "border-l-2 border-l-burnt-orange border-t-dark-border border-r-dark-border border-b-dark-border"
          : "border-dark-border"
      }`}
    >
      {/* Header — always visible, clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 flex items-start justify-between gap-2"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">{session.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${DIMENSION_COLORS[session.dimension] || "bg-dark-border text-dark-muted"}`}>
              {DIMENSION_LABELS[session.dimension] || session.dimension}
            </span>
            <span className="text-xs text-dark-muted capitalize">
              {session.environment.replace(/_/g, " ")}
            </span>
          </div>
          {isMatched && matchReason && (
            <p className="text-xs text-burnt-orange mt-2">{matchReason}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {session.completed && (
            <svg className="w-4 h-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {full && (
            <svg
              className={`w-4 h-4 text-dark-muted transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && full && (
        <div className="px-3 pb-3 pt-1 border-t border-dark-border/30 space-y-3">
          <p className="text-xs text-dark-muted/80 italic leading-relaxed">{full.objective}</p>

          {/* Warm-up */}
          {full.warmUp && (
            <div>
              <h5 className="text-[10px] font-semibold text-gold/70 uppercase tracking-widest mb-1.5">
                Warm-Up · {full.warmUp.rounds} round{full.warmUp.rounds > 1 ? "s" : ""}
              </h5>
              <ul className="text-xs text-dark-muted space-y-0.5">
                {full.warmUp.exercises.map((ex, j) => (
                  <li key={j} className="flex gap-1.5">
                    <span className="text-dark-muted/40 select-none">-</span>
                    <span>{ex.name} <span className="text-dark-muted/60">{ex.reps}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Training */}
          {full.training && full.training.length > 0 && (
            <div>
              <h5 className="text-[10px] font-semibold text-gold/70 uppercase tracking-widest mb-1.5">Training</h5>
              <ol className="text-xs text-dark-muted space-y-2">
                {full.training.map((ex) => (
                  <li key={ex.exerciseNumber}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-dark-muted/40 text-[10px] tabular-nums select-none">{ex.exerciseNumber}.</span>
                      <span className="text-dark-text text-xs font-medium">{ex.description}</span>
                    </div>
                    <p className="text-dark-muted/70 text-[11px] pl-4 leading-relaxed">{ex.details}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Cooldown */}
          {full.cooldown && (
            <div>
              <h5 className="text-[10px] font-semibold text-gold/70 uppercase tracking-widest mb-1.5">Cooldown</h5>
              <p className="text-xs text-dark-muted leading-relaxed">{full.cooldown}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
