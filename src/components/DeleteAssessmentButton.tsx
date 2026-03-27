"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAssessmentButton({
  assessmentId,
  objectiveId,
}: {
  assessmentId: string;
  objectiveId: string;
}) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete assessment");
      }

      setShowConfirm(false);
      setDeleting(false);
      // Go back to assessment page for this objective
      router.push(`/assessment/${objectiveId}`);
    } catch (error) {
      console.error("Error deleting assessment:", error);
      alert(error instanceof Error ? error.message : "Failed to delete assessment");
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-sm text-dark-muted hover:text-red-400 transition-colors"
      >
        Retake Assessment
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 max-w-sm w-full animate-scale-in">
            <h3 className="text-lg font-bold text-white mb-2">Retake Assessment?</h3>
            <p className="text-sm text-dark-muted mb-6">
              This will delete your current assessment scores and let you reassess your fitness for this objective.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-dark-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Retake Assessment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
