"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy assessment page — redirects to calendar (objective-first flow).
 * The actual assessment now lives at /assessment/[objectiveId].
 */
export default function AssessmentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/calendar");
  }, [router]);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 text-center">
      <p className="text-dark-muted">Redirecting — create an objective first, then assess...</p>
    </div>
  );
}
