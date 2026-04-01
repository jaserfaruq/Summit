"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { lookupExerciseDemo } from "@/lib/exercise-demos";

interface ExerciseDemoButtonProps {
  exerciseName: string;
}

interface VideoResult {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
}

// Maps the curated ExerciseDemo (youtubeId) to the VideoResult shape (videoId)
function curatedToVideo(curated: { youtubeId: string; title: string; channelName: string }): VideoResult {
  return {
    videoId: curated.youtubeId,
    title: curated.title,
    channelName: curated.channelName,
    thumbnailUrl: `https://img.youtube.com/vi/${curated.youtubeId}/mqdefault.jpg`,
  };
}

export default function ExerciseDemoButton({ exerciseName }: ExerciseDemoButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lookup, setLookup] = useState<{ searchQuery: string; youtubeSearchUrl: string; googleSearchUrl: string; curatedVideo: VideoResult | null } | null>(null);
  const [apiResults, setApiResults] = useState<VideoResult[] | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const fetchApiResults = useCallback(async (searchQuery: string) => {
    setApiLoading(true);
    try {
      const res = await fetch(
        `/api/exercise-demo?q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setApiResults(data.results || []);
      } else {
        setApiResults([]);
      }
    } catch {
      setApiResults([]);
    } finally {
      setApiLoading(false);
    }
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    const result = lookupExerciseDemo(exerciseName);
    setLookup({
      searchQuery: result.searchQuery,
      youtubeSearchUrl: result.youtubeSearchUrl,
      googleSearchUrl: result.googleSearchUrl,
      curatedVideo: result.curated ? curatedToVideo(result.curated) : null,
    });
    setApiResults(null);
    setOpen(true);

    fetchApiResults(result.searchQuery);
  }

  function handleClose(e?: React.MouseEvent) {
    if (e) {
      e.stopPropagation();
    }
    setOpen(false);
  }

  // Build deduplicated video list
  const videos: VideoResult[] = [];
  const seenIds = new Set<string>();

  if (lookup?.curatedVideo) {
    videos.push(lookup.curatedVideo);
    seenIds.add(lookup.curatedVideo.videoId);
  }

  if (apiResults) {
    for (const result of apiResults) {
      if (!seenIds.has(result.videoId)) {
        videos.push(result);
        seenIds.add(result.videoId);
      }
    }
  }

  const modal = open && lookup ? (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-dark-surface border border-dark-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[85vh] overflow-y-auto p-5 animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-2">
          <h3 className="text-sm font-bold text-dark-text leading-snug">
            {exerciseName}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-dark-muted hover:text-white text-xl leading-none px-1 shrink-0"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Video results */}
        <div className="space-y-2">
          {videos.map((video) => (
            <a
              key={video.videoId}
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                alt={video.title}
                width={120}
                height={68}
                className="rounded object-cover bg-dark-card shrink-0"
                style={{ width: 120, height: 68 }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-dark-text line-clamp-2">
                  {video.title}
                </p>
                <p className="text-xs text-dark-muted mt-0.5">
                  {video.channelName}
                </p>
              </div>
            </a>
          ))}

          {/* Loading state */}
          {apiLoading && (
            <div className="flex items-center gap-2 py-2">
              <svg
                className="animate-spin h-4 w-4 text-dark-muted"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-xs text-dark-muted">
                Searching for demos...
              </span>
            </div>
          )}

          {/* Empty state */}
          {!apiLoading && apiResults !== null && videos.length === 0 && (
            <p className="text-sm text-dark-muted py-2">
              No demos found — try searching manually:
            </p>
          )}
        </div>

        {/* Separator */}
        <div className="border-t border-dark-border my-4" />

        {/* Fallback links */}
        <div className="space-y-2">
          <a
            href={lookup.youtubeSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-sage hover:text-dark-text transition-colors"
          >
            <span>Search YouTube</span>
            <svg
              className="w-3 h-3 shrink-0"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"
              />
            </svg>
          </a>
          <a
            href={lookup.googleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-sage hover:text-dark-text transition-colors"
          >
            <span>Search Google Images</span>
            <svg
              className="w-3 h-3 shrink-0"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center justify-center ml-1 text-dark-muted/40 hover:text-dark-muted/70 transition-colors cursor-pointer"
        aria-label={`Watch demo: ${exerciseName}`}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M6.5 5.5L11 8L6.5 10.5V5.5Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
