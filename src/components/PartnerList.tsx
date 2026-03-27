"use client";

import { useState } from "react";
import { AcceptedPartner, PendingPartner } from "@/lib/types";
import PartnerCard from "./PartnerCard";
import PartnerInviteForm from "./PartnerInviteForm";

export default function PartnerList({
  accepted,
  pending,
  selectedPartnerId,
  onSelectPartner,
  onRefresh,
}: {
  accepted: AcceptedPartner[];
  pending: PendingPartner[];
  selectedPartnerId: string | null;
  onSelectPartner: (partnerId: string) => void;
  onRefresh: () => void;
}) {
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function handleRespond(partnershipId: string, action: "accept" | "decline") {
    setRespondingId(partnershipId);
    try {
      const res = await fetch("/api/partners/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnershipId, action }),
      });
      if (!res.ok) throw new Error("Failed to respond");
      onRefresh();
    } catch (err) {
      console.error("Error responding to invite:", err);
    } finally {
      setRespondingId(null);
    }
  }

  async function handleRemove(partnershipId: string) {
    try {
      const res = await fetch("/api/partners/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnershipId }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      onRefresh();
    } catch (err) {
      console.error("Error removing partner:", err);
    }
  }

  async function handleToggleScores(partnershipId: string, shareScores: boolean) {
    try {
      const res = await fetch("/api/partners/toggle-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnershipId, shareScores }),
      });
      if (!res.ok) throw new Error("Failed to toggle scores");
      onRefresh();
    } catch (err) {
      console.error("Error toggling scores:", err);
    }
  }

  const receivedInvites = pending.filter((p) => p.direction === "received");
  const sentInvites = pending.filter((p) => p.direction === "sent");

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Add Partner</h2>
        <PartnerInviteForm onInvited={onRefresh} />
      </div>

      {/* Received invites */}
      {receivedInvites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Pending Invites</h2>
          <div className="space-y-2">
            {receivedInvites.map((p) => (
              <div
                key={p.partnershipId}
                className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between"
              >
                <span className="text-sm text-white">{p.partnerName}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(p.partnershipId, "accept")}
                    disabled={respondingId === p.partnershipId}
                    className="bg-forest hover:bg-forest/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespond(p.partnershipId, "decline")}
                    disabled={respondingId === p.partnershipId}
                    className="text-xs text-dark-muted hover:text-white transition-colors px-3 py-1.5"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted partners */}
      {accepted.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Partners</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {accepted.map((p) => (
              <PartnerCard
                key={p.partnershipId}
                partner={p}
                onSelect={onSelectPartner}
                isSelected={selectedPartnerId === p.partnerId}
                onRemove={handleRemove}
                onToggleScores={handleToggleScores}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sent invites */}
      {sentInvites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-dark-muted mb-2 text-xs uppercase tracking-wide">Sent Invites</h2>
          <div className="space-y-2">
            {sentInvites.map((p) => (
              <div
                key={p.partnershipId}
                className="bg-dark-card/50 border border-dark-border/50 rounded-xl p-3 flex items-center justify-between"
              >
                <span className="text-sm text-dark-muted">{p.partnerName}</span>
                <span className="text-xs text-dark-muted">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {accepted.length === 0 && pending.length === 0 && (
        <div className="text-center py-8">
          <p className="text-dark-muted text-sm">
            Invite a training partner to see each other&apos;s weeks and train together.
          </p>
        </div>
      )}
    </div>
  );
}
