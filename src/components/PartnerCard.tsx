"use client";

import { useState } from "react";
import { AcceptedPartner } from "@/lib/types";

export default function PartnerCard({
  partner,
  onSelect,
  isSelected,
  onRemove,
  onToggleScores,
}: {
  partner: AcceptedPartner;
  onSelect: (partnerId: string) => void;
  isSelected: boolean;
  onRemove: (partnershipId: string) => void;
  onToggleScores: (partnershipId: string, share: boolean) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    onRemove(partner.partnershipId);
  }

  return (
    <div
      className={`bg-dark-card border rounded-xl p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-gold/50 ring-1 ring-gold/20"
          : "border-dark-border hover:border-dark-border/80"
      }`}
      onClick={() => onSelect(partner.partnerId)}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-semibold text-sm truncate">{partner.partnerName}</h3>
          {partner.objectiveName && (
            <p className="text-dark-muted text-xs mt-0.5 truncate">
              Training for {partner.objectiveName}
            </p>
          )}
          {partner.weekLabel && (
            <p className="text-dark-muted text-xs">{partner.weekLabel}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
          className="text-dark-muted hover:text-white p-1 transition-colors"
          title="Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
          </svg>
        </button>
      </div>

      {/* Session completion dots */}
      {partner.currentWeekSessions.length > 0 && (
        <div className="flex gap-1.5 mt-3">
          {partner.currentWeekSessions.map((s, i) => (
            <div
              key={i}
              title={`${s.name} (${s.dimension})`}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                s.completed
                  ? "bg-forest"
                  : "bg-dark-border"
              }`}
            />
          ))}
        </div>
      )}

      {/* Settings dropdown */}
      {showSettings && (
        <div
          className="mt-3 pt-3 border-t border-dark-border space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex items-center gap-2 text-xs text-dark-muted cursor-pointer">
            <input
              type="checkbox"
              checked={partner.scoresVisible}
              onChange={(e) => onToggleScores(partner.partnershipId, e.target.checked)}
              className="rounded border-dark-border bg-dark-surface text-forest focus:ring-forest/50"
            />
            Share my scores
          </label>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            {removing ? "Removing..." : "Remove partner"}
          </button>
        </div>
      )}
    </div>
  );
}
