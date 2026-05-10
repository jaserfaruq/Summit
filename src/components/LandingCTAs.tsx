"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ObjectiveModal from "./ObjectiveModal";

interface DraftSummary {
  objectiveName: string | null;
  resumeRoute: string;
}

const STORAGE_KEY = "summit-draft-plan";

function readDraftSummary(): DraftSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.objective?.name) return null;

    let resumeRoute = "/dashboard";
    if (parsed.plan) resumeRoute = "/plan";
    else if (parsed.assessment) resumeRoute = "/plan";
    else if (parsed.objective) resumeRoute = "/assessment/draft";

    return {
      objectiveName: parsed.objective.name as string,
      resumeRoute,
    };
  } catch {
    return null;
  }
}

export default function LandingCTAs() {
  const [draft, setDraft] = useState<DraftSummary | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setDraft(readDraftSummary());
    setHydrated(true);
  }, []);

  if (!hydrated) {
    // SSR-safe placeholder — match the dimensions of the loaded state
    return (
      <div className="flex flex-wrap gap-3">
        <span className="bg-burnt-orange/80 text-white font-semibold py-3 px-7 rounded-lg text-sm opacity-0">
          Loading
        </span>
      </div>
    );
  }

  if (draft?.objectiveName) {
    return (
      <div className="flex flex-wrap gap-3">
        <Link
          href={draft.resumeRoute}
          className="bg-burnt-orange hover:bg-burnt-orange/90 text-white font-semibold py-3 px-7 rounded-lg transition-colors text-sm"
        >
          Resume planning for {draft.objectiveName} →
        </Link>
        <Link
          href="/login"
          className="border border-white/20 text-white/80 hover:text-white hover:border-white/40 font-semibold py-3 px-7 rounded-lg transition-colors text-sm"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="bg-burnt-orange hover:bg-burnt-orange/90 text-white font-semibold py-3 px-7 rounded-lg transition-colors text-sm"
        >
          Plan your summit
        </button>
        <Link
          href="/login"
          className="border border-white/20 text-white/80 hover:text-white hover:border-white/40 font-semibold py-3 px-7 rounded-lg transition-colors text-sm"
        >
          Log In
        </Link>
      </div>

      {showModal && createPortal(
        <ObjectiveModal
          date={null}
          objective={null}
          onClose={() => setShowModal(false)}
          onSaved={() => setShowModal(false)}
        />,
        document.body
      )}
    </>
  );
}
