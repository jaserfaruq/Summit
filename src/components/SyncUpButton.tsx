"use client";

import { useState } from "react";
import { PlanSession } from "@/lib/types";

export default function SyncUpButton({
  planId,
  weekNumber,
  sessionIndex,
  onSwapped,
}: {
  planId: string;
  weekNumber: number;
  sessionIndex: number;
  onSwapped: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<PlanSession[] | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSyncUp() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, weekNumber, sessionIndex }),
      });
      if (!res.ok) throw new Error("Failed to generate alternatives");
      const data = await res.json();
      setAlternatives(data.alternatives);
    } catch {
      setError("Failed to generate alternatives");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(alt: PlanSession) {
    setSwapping(true);
    try {
      const res = await fetch("/api/replace-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          weekNumber,
          sessionIndex,
          replacementSession: alt,
        }),
      });
      if (!res.ok) throw new Error("Failed to replace session");
      setAlternatives(null);
      onSwapped();
    } catch {
      setError("Failed to swap session");
    } finally {
      setSwapping(false);
    }
  }

  if (alternatives) {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-xs text-dark-muted">Pick an alternative:</p>
        {alternatives.map((alt, i) => (
          <button
            key={i}
            onClick={() => handleSelect(alt)}
            disabled={swapping}
            className="w-full text-left bg-dark-surface/80 border border-dark-border hover:border-gold/30 rounded-lg p-2.5 transition-colors disabled:opacity-50"
          >
            <p className="text-sm text-white">{alt.name}</p>
            <p className="text-xs text-dark-muted mt-0.5">{alt.objective}</p>
          </button>
        ))}
        <button
          onClick={() => setAlternatives(null)}
          className="text-xs text-dark-muted hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        onClick={handleSyncUp}
        disabled={loading}
        className="text-xs text-burnt-orange hover:text-burnt-orange/80 font-medium transition-colors disabled:opacity-50"
      >
        {loading ? "Loading alternatives..." : "Sync Up"}
      </button>
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}
