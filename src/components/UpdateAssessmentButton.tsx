"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UpdateAssessmentButtonProps {
  /** If a plan exists, offer to regenerate it after retaking */
  planId?: string;
  objectiveId?: string;
}

export default function UpdateAssessmentButton({
  planId,
  objectiveId,
}: UpdateAssessmentButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleClick() {
    if (planId) {
      setShowConfirm(true);
    } else {
      router.push("/assessment");
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="text-sm text-dark-muted hover:text-white border border-dark-border hover:border-sage px-3 py-1.5 rounded-lg transition-colors"
      >
        Retake Assessment
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">
              Retake Assessment?
            </h3>
            <p className="text-sm text-dark-muted mb-6">
              After completing the new assessment, your current plan will be
              regenerated using the updated scores. Your workout logs will be
              kept.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-dark-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (planId) params.set("planId", planId);
                  if (objectiveId) params.set("objectiveId", objectiveId);
                  router.push(`/assessment?${params.toString()}`);
                }}
                className="px-4 py-2 text-sm bg-gold hover:bg-gold/90 text-dark-bg rounded-lg font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
