"use client";

import { useState, useEffect } from "react";

interface AILoadingIndicatorProps {
  /** Primary message, e.g. "Analyzing your responses..." */
  message: string;
  /** Optional sub-message, e.g. "This may take 15-30 seconds" */
  subMessage?: string;
  /** Optional array of rotating tips/messages shown below the spinner */
  rotatingMessages?: string[];
  /** Rotation interval in ms (default 4000) */
  rotationInterval?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

export default function AILoadingIndicator({
  message,
  subMessage,
  rotatingMessages,
  rotationInterval = 4000,
  size = "md",
}: AILoadingIndicatorProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Rotate messages
  useEffect(() => {
    if (!rotatingMessages || rotatingMessages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % rotatingMessages.length);
    }, rotationInterval);
    return () => clearInterval(interval);
  }, [rotatingMessages, rotationInterval]);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sizeConfig = {
    sm: { spinner: "w-6 h-6 border-2", text: "text-sm", sub: "text-xs", gap: "space-y-2", py: "py-4" },
    md: { spinner: "w-10 h-10 border-3", text: "text-base", sub: "text-sm", gap: "space-y-3", py: "py-10" },
    lg: { spinner: "w-14 h-14 border-4", text: "text-lg", sub: "text-sm", gap: "space-y-4", py: "py-16" },
  };

  const s = sizeConfig[size];

  return (
    <div className={`text-center ${s.py} ${s.gap} flex flex-col items-center`}>
      {/* Pulsing ring spinner */}
      <div className="relative">
        <div
          className={`${s.spinner} border-gold/30 rounded-full`}
        />
        <div
          className={`absolute inset-0 ${s.spinner} border-transparent border-t-gold rounded-full animate-spin`}
        />
        <div
          className={`absolute inset-0 ${s.spinner} border-transparent border-t-gold/40 rounded-full animate-spin`}
          style={{ animationDuration: "1.5s", animationDirection: "reverse" }}
        />
      </div>

      {/* Primary message */}
      <p className={`${s.text} text-dark-text/90 font-medium`}>{message}</p>

      {/* Sub-message or rotating messages */}
      {rotatingMessages && rotatingMessages.length > 0 ? (
        <p
          key={currentMessageIndex}
          className={`${s.sub} text-dark-muted animate-fade-in max-w-xs`}
        >
          {rotatingMessages[currentMessageIndex]}
        </p>
      ) : subMessage ? (
        <p className={`${s.sub} text-dark-muted`}>{subMessage}</p>
      ) : null}

      {/* Elapsed time — shows after 8 seconds so users know it's still working */}
      {elapsed >= 8 && (
        <p className="text-xs text-dark-muted/60 animate-fade-in">
          {elapsed}s — still working, hang tight
        </p>
      )}
    </div>
  );
}
