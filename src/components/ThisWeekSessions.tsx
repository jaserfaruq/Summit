"use client";

import { useState } from "react";
import Link from "next/link";
import { WeeklyTarget, PlanSession, SkillPracticeItem } from "@/lib/types";
import AlternativesPanel from "./AlternativesPanel";

export default function ThisWeekSessions({
  weekTarget,
  planId,
}: {
  weekTarget: WeeklyTarget;
  planId: string;
}) {
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [skillPracticeExpanded, setSkillPracticeExpanded] = useState(false);
  const [sessions, setSessions] = useState<PlanSession[]>(weekTarget.sessions);
  const [alternativesPanel, setAlternativesPanel] = useState<{
    sessionIndex: number;
    session: PlanSession;
  } | null>(null);

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
        {sessions.map((session, i) => {
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
                    className={`w-4 h-4 text-dark-muted shrink-0 chevron-smooth ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium text-sm text-white truncate">{session.name}</span>
                  {session.isAlternative && (
                    <span className="text-[10px] bg-burnt-orange/20 text-burnt-orange px-1.5 py-0.5 rounded font-medium shrink-0">Alt</span>
                  )}
                </button>
                <Link
                  href={`/log?session=${encodeURIComponent(session.name)}&planId=${planId}&week=${weekTarget.week_number}`}
                  className="btn-press text-sm bg-gold/90 text-dark-bg px-3 py-1 rounded hover:bg-gold transition-colors font-medium shrink-0 ml-3"
                >
                  Log
                </Link>
              </div>

              {isExpanded && (
                <div className="session-content-enter px-4 pb-2 flex items-center gap-3 border-t border-dark-border/50 pt-3">
                  <span className="text-dark-muted text-xs">{session.estimatedMinutes} min</span>
                  <button
                    onClick={() => setAlternativesPanel({ sessionIndex: i, session })}
                    className="btn-press text-xs text-dark-muted hover:text-white px-2 py-1 rounded hover:bg-dark-border/50 transition-colors"
                  >
                    Alternatives
                  </button>
                </div>
              )}
              {isExpanded && (
                <div className="session-content-enter">
                  <SessionDetails session={session} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Suggested Skill Practice (expandable) */}
      {weekTarget.suggested_skill_practice && (weekTarget.suggested_skill_practice as SkillPracticeItem[]).length > 0 && (
        <div className="mt-3 rounded-lg border border-sage/20 bg-sage/5 px-3 py-2">
          <button
            onClick={() => setSkillPracticeExpanded(!skillPracticeExpanded)}
            className="w-full text-left flex items-center justify-between"
          >
            <div>
              <h5 className="text-[10px] font-semibold text-sage uppercase tracking-widest mb-0.5">
                Suggested Skill Practice
              </h5>
              <p className="text-[11px] text-dark-muted">
                Practice these when you have time and access to appropriate terrain.
              </p>
            </div>
            <svg className={`w-4 h-4 text-sage transition-transform ${skillPracticeExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {skillPracticeExpanded && (
            <ul className="space-y-2 mt-3">
              {(weekTarget.suggested_skill_practice as SkillPracticeItem[]).map((item, i) => (
                <li key={i} className="text-sm text-dark-text">
                  <span className="font-medium">{item.skill}</span>
                  <span className="text-dark-muted"> — {item.terrain}</span>
                  <p className="text-[13px] text-dark-muted mt-0.5">{item.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Alternatives Panel */}
      {alternativesPanel && (
        <AlternativesPanel
          isOpen={!!alternativesPanel}
          onClose={() => setAlternativesPanel(null)}
          planId={planId}
          weekNumber={weekTarget.week_number}
          sessionIndex={alternativesPanel.sessionIndex}
          session={alternativesPanel.session}
          onSessionReplaced={(newSessions) => {
            setSessions(newSessions);
            setAlternativesPanel(null);
          }}
        />
      )}
    </div>
  );
}

function SessionDetails({ session }: { session: PlanSession }) {
  return (
    <div className="px-4 pb-4 space-y-3 pt-1">
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
