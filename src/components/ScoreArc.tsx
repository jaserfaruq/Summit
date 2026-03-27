"use client";

import { useState, useEffect, useRef } from "react";
import { scoreArcColor } from "@/lib/scoring";

export default function ScoreArc({
  label,
  tagline,
  current,
  target,
  size = "default",
  animationDelay = 0,
}: {
  label: string;
  tagline?: string;
  current: number;
  target: number;
  size?: "mini" | "default";
  animationDelay?: number;
}) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const color = scoreArcColor(current, target);
  const colorMap = {
    green: { stroke: "#22c55e", text: "text-green-400" },
    yellow: { stroke: "#eab308", text: "text-yellow-400" },
    red: { stroke: "#ef4444", text: "text-red-400" },
  };
  const { stroke, text } = colorMap[color];

  if (size === "mini") {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="text-center">
        <div className="relative inline-block">
          <svg width="50" height="50" className="-rotate-90">
            <circle cx="25" cy="25" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
            <circle
              cx="25"
              cy="25"
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-bold ${text}`}>{current}</span>
          </div>
        </div>
        <div className="text-[10px] text-white/60 mt-0.5">{label}</div>
        <div className="text-[10px] text-white/40">/ {target}</div>
      </div>
    );
  }

  return (
    <DefaultArc
      label={label}
      tagline={tagline}
      current={current}
      target={target}
      percentage={percentage}
      stroke={stroke}
      text={text}
      animationDelay={animationDelay}
    />
  );
}

function DefaultArc({
  label,
  tagline,
  current,
  target,
  percentage,
  stroke,
  text,
  animationDelay,
}: {
  label: string;
  tagline?: string;
  current: number;
  target: number;
  percentage: number;
  stroke: string;
  text: string;
  animationDelay: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [displayNumber, setDisplayNumber] = useState(0);
  const frameRef = useRef<number>();

  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), animationDelay);
    return () => clearTimeout(timer);
  }, [animationDelay]);

  // Count-up animation for the number
  useEffect(() => {
    if (!mounted || current === 0) return;

    const duration = 600; // ms
    const startTime = performance.now();

    function animate(time: number) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-quart
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayNumber(Math.round(eased * current));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [mounted, current]);

  const strokeDashoffset = mounted
    ? circumference - (percentage / 100) * circumference
    : circumference;

  return (
    <div
      className="bg-dark-card/80 backdrop-blur-sm rounded-xl p-4 text-center border border-dark-border/50"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "scale(1)" : "scale(0.8)",
        transition: `opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1), transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)`,
      }}
    >
      <div className="relative inline-block">
        <svg width="100" height="100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.25, 1, 0.5, 1) 0.15s",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div>
            <div className={`text-lg font-bold ${text}`}>{mounted ? displayNumber : 0}</div>
            <div className="text-xs text-dark-muted">/ {target}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 font-semibold text-white text-sm">{label}</div>
      {tagline && (
        <div className="text-xs text-dark-muted mt-0.5 italic">{tagline}</div>
      )}
    </div>
  );
}
