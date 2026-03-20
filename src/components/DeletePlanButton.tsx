"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeletePlanButton({ planId, onDeleted }: { planId: string; onDeleted?: () => void }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete plan");
      }

      setShowConfirm(false);
      setDeleting(false);
      if (onDeleted) {
        onDeleted();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Error deleting plan:", error);
      alert(error instanceof Error ? error.message : "Failed to delete plan");
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-sm text-red-400 hover:text-red-300 border border-red-800/50 hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors"
      >
        Delete Plan
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">Delete Training Plan?</h3>
            <p className="text-sm text-dark-muted mb-6">
              This will permanently delete your current plan, objective, and all weekly targets. Your workout logs will be kept.
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
                {deleting ? "Deleting..." : "Delete Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
