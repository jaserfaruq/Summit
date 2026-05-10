"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const STORAGE_KEY = "summit-draft-plan";

type ImportState = "checking" | "no-draft" | "saving" | "success" | "error";

export default function DraftImportPage() {
  const router = useRouter();
  const [state, setState] = useState<ImportState>("checking");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function persistDraft() {
      // Read draft
      let draft: unknown;
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        if (!raw) {
          if (!cancelled) setState("no-draft");
          return;
        }
        draft = JSON.parse(raw);
      } catch {
        if (!cancelled) {
          setErrorMessage("Could not read your draft from this browser.");
          setState("error");
        }
        return;
      }

      const draftAny = draft as { objective?: unknown; assessment?: unknown; plan?: unknown };
      if (!draftAny?.objective || !draftAny?.assessment || !draftAny?.plan) {
        if (!cancelled) setState("no-draft");
        return;
      }

      if (!cancelled) setState("saving");

      try {
        const res = await fetch("/api/persist-guest-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Save failed (${res.status})`);
        }
        // Success — clear local draft and route to plan
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        if (!cancelled) {
          setState("success");
          router.replace("/plan");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : "Failed to save your plan.");
          setState("error");
        }
      }
    }

    persistDraft();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="fixed inset-0 -z-10">
        <Image src="/IMG_0232.jpeg" alt="" fill className="object-cover scale-105" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/80" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-dark-bg/85 backdrop-blur-md rounded-2xl p-8 border border-dark-border/50 text-center">
          {(state === "checking" || state === "saving") && (
            <>
              <div className="text-4xl mb-4">⛰️</div>
              <h2 className="text-xl font-bold text-white mb-2">
                {state === "checking" ? "Looking for your draft..." : "Saving your plan..."}
              </h2>
              <p className="text-sm text-dark-muted">
                {state === "checking"
                  ? "Reading your in-progress plan from this browser."
                  : "Locking in your objective, assessment, and week 1 sessions."}
              </p>
              <div className="mt-6 flex justify-center">
                <svg className="animate-spin h-6 w-6 text-gold" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </>
          )}

          {state === "success" && (
            <>
              <div className="text-4xl mb-4">✓</div>
              <h2 className="text-xl font-bold text-white mb-2">Plan saved!</h2>
              <p className="text-sm text-dark-muted">Taking you to your plan...</p>
            </>
          )}

          {state === "no-draft" && (
            <>
              <div className="text-4xl mb-4">👋</div>
              <h2 className="text-xl font-bold text-white mb-2">No draft found</h2>
              <p className="text-sm text-dark-muted mb-6">
                We didn&apos;t find a saved draft in this browser. Head to your dashboard to get started.
              </p>
              <Link
                href="/dashboard"
                className="inline-block bg-gold text-dark-bg font-semibold py-2.5 px-5 rounded-lg hover:bg-gold/90 transition-colors text-sm"
              >
                Go to Dashboard
              </Link>
            </>
          )}

          {state === "error" && (
            <>
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-white mb-2">Couldn&apos;t save your plan</h2>
              <p className="text-sm text-dark-muted mb-6">{errorMessage}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-gold text-dark-bg font-semibold py-2.5 px-5 rounded-lg hover:bg-gold/90 transition-colors text-sm"
                >
                  Try Again
                </button>
                <Link
                  href="/dashboard"
                  className="border border-white/20 text-white/80 hover:text-white hover:border-white/40 font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm"
                >
                  Skip to Dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
