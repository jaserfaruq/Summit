"use client";

import { useState } from "react";
import Link from "next/link";
import { WeeklyTarget, PlanSession } from "@/lib/types";

export default function ThisWeekSessions({
  weekTarget,
  planId,
}: {
  weekTarget: WeeklyTarget;
  planId: string;
}) {
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

  function toggle(i: number) {
    setExpandedSession(expandedSession === i ? null : i);
  }

  return (
    <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold text-white">This Week</h3>
        <span className="text-dark-muted text-sm ml-auto">
          Week {weekTarget.week_number} · {weekTarget.total_hours}h planned
        </span>
      </div>
      <div className="space-y-2">
        {weekTarget.sessions.map((session, i) => {
          const isExpanded = expandedSession === i;
          return (
            <div
              key={i}
              className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden"
            >
              <div className="flex items-center justify-between p-3">
                <button
                  onClick={() => toggle(i)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  <svg
                    className={`w-4 h-4 text-dark-muted shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium text-sm text-white truncate">{session.name}</span>
                  <span className="text-dark-muted text-xs shrink-0">{session.estimatedMinutes} min</span>
                </button>
                <Link
                  href={`/log?session=${encodeURIComponent(session.name)}&planId=${planId}&week=${weekTarget.week_number}`}
                  className="text-sm bg-gold/90 text-dark-bg px-3 py-1 rounded hover:bg-gold transition-colors font-medium shrink-0 ml-3"
                >
                  Mark Complete
                </Link>
              </div>

              {isExpanded && (
                <SessionDetails session={session} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionDetails({ session }: { session: PlanSession }) {
  return (
    <div className="px-4 pb-4 space-y-3 border-t border-dark-border/50 pt-3">
      <p className="text-sm text-dark-muted italic">{session.objective}</p>

      {session.warmUp && (
        <div>
          <h5 className="text-xs font-semibold text-gold uppercase mb-1">
            Warm-Up ({session.warmUp.rounds} round{session.warmUp.rounds > 1 ? "s" : ""})
          </h5>
          <ul className="text-sm text-dark-muted space-y-0.5">
            {session.warmUp.exercises.map((ex, j) => (
              <li key={j}>• {ex.name} — {ex.reps}</li>
            ))}
          </ul>
        </div>
      )}

      {session.training && (
        <div>
          <h5 className="text-xs font-semibold text-gold uppercase mb-1">Training</h5>
          <ol className="text-sm text-dark-muted space-y-1.5">
            {session.training.map((ex) => (
              <li key={ex.exerciseNumber}>
                <span className="font-medium text-dark-text">
                  {ex.exerciseNumber}. {ex.description}
                  {ex.durationMinutes ? (
                    <span className="text-dark-muted font-normal text-xs ml-2">{ex.durationMinutes} min</span>
                  ) : null}
                </span>
                <br />
                <span className="text-dark-muted">{ex.details}</span>
                {ex.intensityNote && (
                  <span className="block text-dark-muted text-xs italic">{ex.intensityNote}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {session.cooldown && (
        <div>
          <h5 className="text-xs font-semibold text-gold uppercase mb-1">Cooldown</h5>
          <p className="text-sm text-dark-muted">{session.cooldown}</p>
        </div>
      )}
    </div>
  );
}
