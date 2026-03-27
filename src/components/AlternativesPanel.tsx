"use client";

import { useState, useEffect } from "react";
import { PlanSession, AlternativeSession } from "@/lib/types";
import AILoadingIndicator from "@/components/AILoadingIndicator";

interface AlternativesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  weekNumber: number;
  sessionIndex: number;
  session: PlanSession;
  onSessionReplaced: (newSessions: PlanSession[]) => void;
}

export default function AlternativesPanel({
  isOpen,
  onClose,
  planId,
  weekNumber,
  sessionIndex,
  session,
  onSessionReplaced,
}: AlternativesPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeSession[] | null>(null);
  const [original, setOriginal] = useState<PlanSession | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAlternatives(null);
      setError(null);
      setExpandedIndex(null);
      generateAlternatives();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, planId, weekNumber, sessionIndex]);

  async function generateAlternatives() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, weekNumber, sessionIndex }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate alternatives");
      }
      const data = await res.json();
      setOriginal(data.original);
      setAlternatives(data.alternatives);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleReplace(selectedSession: PlanSession & { alternativeRationale?: string }) {
    setReplacing(true);
    try {
      // Strip alternativeRationale before saving (it's display-only from Claude)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { alternativeRationale, durationDifference, ...sessionData } = selectedSession as AlternativeSession;
      const res = await fetch("/api/replace-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          weekNumber,
          sessionIndex,
          replacementSession: { ...sessionData, isAlternative: true },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to replace session");
      }
      const data = await res.json();
      onSessionReplaced(data.sessions);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to replace session");
    } finally {
      setReplacing(false);
    }
  }

  async function handleRestore() {
    if (!session.originalSession) return;
    setReplacing(true);
    try {
      const res = await fetch("/api/replace-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          weekNumber,
          sessionIndex,
          replacementSession: { ...session.originalSession, isAlternative: false },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore session");
      }
      const data = await res.json();
      onSessionReplaced(data.sessions);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore session");
    } finally {
      setReplacing(false);
    }
  }

  if (!isOpen) return null;

  // Build the list of options: original + alternatives
  const originalSession = original || session.originalSession || session;
  const options: Array<{ session: PlanSession | AlternativeSession; label: string; isOriginal: boolean; isCurrent: boolean }> = [
    {
      session: originalSession,
      label: "Original",
      isOriginal: true,
      isCurrent: !session.isAlternative,
    },
  ];

  if (alternatives) {
    alternatives.forEach((alt, i) => {
      options.push({
        session: alt,
        label: `Alternative ${i + 1}`,
        isOriginal: false,
        isCurrent: false,
      });
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] max-w-full bg-dark-card border-l border-dark-border z-50 flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
          <div>
            <h2 className="text-lg font-semibold text-white">Workout Alternatives</h2>
            <p className="text-xs text-dark-muted mt-0.5">{session.isAlternative ? session.originalSession?.name || session.name : session.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && (
            <AILoadingIndicator
              size="md"
              message="Generating alternatives..."
              rotatingMessages={[
                "Finding outdoor and gym options...",
                "Matching difficulty to your current level...",
                "Building varied session formats...",
              ]}
            />
          )}

          {error && !loading && (
            <div className="py-6 text-center bg-red-900/20 rounded-lg border border-red-800 px-4">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={generateAlternatives}
                className="text-sm bg-gold text-dark-bg px-4 py-2 rounded hover:bg-gold/90 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && options.map((option, idx) => {
            const isExpanded = expandedIndex === idx;
            const alt = option.session as AlternativeSession;

            return (
              <div
                key={idx}
                className={`rounded-lg border transition-colors ${
                  isExpanded
                    ? "border-gold/50 bg-dark-surface"
                    : "border-dark-border bg-dark-surface hover:border-dark-border/80"
                }`}
              >
                {/* Option header */}
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm text-white truncate">
                      {option.session.name}
                    </span>
                    {option.isOriginal && (
                      <span className="text-[10px] bg-dark-border text-dark-muted px-1.5 py-0.5 rounded font-medium shrink-0">
                        Original
                      </span>
                    )}
                    {option.isCurrent && (
                      <span className="text-[10px] bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-dark-muted">{option.session.estimatedMinutes} min</span>
                    {alt.durationDifference && (
                      <span className="text-[10px] text-burnt-orange font-medium">{alt.durationDifference}</span>
                    )}
                    <span className="text-dark-muted text-xs">{isExpanded ? "▾" : "▸"}</span>
                  </div>
                </button>

                {/* Rationale (for alternatives only) */}
                {!option.isOriginal && alt.alternativeRationale && !isExpanded && (
                  <p className="px-4 pb-3 text-xs text-dark-muted -mt-1">{alt.alternativeRationale}</p>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-dark-border/50 pt-3">
                    <p className="text-sm text-dark-muted italic">{option.session.objective}</p>

                    {alt.alternativeRationale && !option.isOriginal && (
                      <p className="text-xs text-burnt-orange">{alt.alternativeRationale}</p>
                    )}

                    {option.session.warmUp && (
                      <div>
                        <h5 className="text-xs font-semibold text-gold uppercase mb-1">
                          Warm-Up ({option.session.warmUp.rounds} round{option.session.warmUp.rounds > 1 ? "s" : ""})
                        </h5>
                        <ul className="text-sm text-dark-muted space-y-0.5">
                          {option.session.warmUp.exercises.map((ex, j) => (
                            <li key={j}>• {ex.name} — {ex.reps}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {option.session.training && (
                      <div>
                        <h5 className="text-xs font-semibold text-gold uppercase mb-1">Training</h5>
                        <ol className="text-sm text-dark-muted space-y-1.5">
                          {option.session.training.map((ex) => (
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

                    {option.session.cooldown && (
                      <div>
                        <h5 className="text-xs font-semibold text-gold uppercase mb-1">Cooldown</h5>
                        <p className="text-sm text-dark-muted">{option.session.cooldown}</p>
                      </div>
                    )}

                    {/* Action button */}
                    <div className="pt-2">
                      {option.isOriginal && session.isAlternative ? (
                        <button
                          onClick={handleRestore}
                          disabled={replacing}
                          className="btn-press w-full text-sm bg-dark-border text-white px-4 py-2.5 rounded-lg hover:bg-dark-border/80 transition-colors font-medium disabled:opacity-50"
                        >
                          {replacing ? "Restoring..." : "Restore Original"}
                        </button>
                      ) : option.isCurrent ? (
                        <p className="text-xs text-dark-muted text-center py-2">This is your current workout</p>
                      ) : !option.isOriginal ? (
                        <button
                          onClick={() => handleReplace(option.session)}
                          disabled={replacing}
                          className="btn-press w-full text-sm bg-gold text-dark-bg px-4 py-2.5 rounded-lg hover:bg-gold/90 transition-colors font-medium disabled:opacity-50"
                        >
                          {replacing ? "Replacing..." : "Use This Workout"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
