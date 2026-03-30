"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function GapInfoBubble() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const modal = open ? (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={(e) => {
        e.stopPropagation();
        setOpen(false);
      }}
    >
      <div
        className="bg-dark-surface border border-dark-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5 animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-red-400">Aggressive timeline</h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="text-dark-muted hover:text-white text-xl leading-none px-1"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <p className="text-sm text-dark-text leading-relaxed">
          The gap here is larger than typical training progression allows. You have a few options: extend your target date, choose a less demanding objective, or lower the difficulty knowing you may not be fully ready — the training is still worthwhile, but you&apos;d be proceeding at your own risk.
        </p>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-red-400/60 text-red-400 text-[10px] font-semibold hover:bg-white/10 transition-colors cursor-pointer"
        aria-label="Info: Aggressive timeline"
      >
        ?
      </button>

      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
