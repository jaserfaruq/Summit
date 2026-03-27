"use client";

export default function PartnerScoreToggle({
  partnershipId,
  currentlySharing,
  partnerSharing,
  onToggle,
}: {
  partnershipId: string;
  currentlySharing: boolean;
  partnerSharing: boolean;
  onToggle: (partnershipId: string, share: boolean) => void;
}) {
  const mutuallySharing = currentlySharing && partnerSharing;

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-dark-muted cursor-pointer">
        <input
          type="checkbox"
          checked={currentlySharing}
          onChange={(e) => onToggle(partnershipId, e.target.checked)}
          className="rounded border-dark-border bg-dark-surface text-forest focus:ring-forest/50"
        />
        Share my scores
      </label>
      {currentlySharing && !partnerSharing && (
        <span className="text-xs text-dark-muted italic">
          Waiting for partner to share theirs
        </span>
      )}
      {mutuallySharing && (
        <span className="text-xs text-forest">Scores visible to both</span>
      )}
    </div>
  );
}
