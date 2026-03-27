"use client";

import { useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface InfoBubbleProps {
  title: string;
  children: ReactNode;
}

export default function InfoBubble({ title, children }: InfoBubbleProps) {
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
          <h3 className="text-base font-bold text-burnt-orange">{title}</h3>
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
        <div className="text-sm text-dark-text space-y-3">
          {children}
        </div>
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
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-sage text-sage text-xs font-semibold ml-1.5 hover:bg-sage/20 transition-colors cursor-pointer"
        aria-label={`Info: ${title}`}
      >
        i
      </button>

      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
