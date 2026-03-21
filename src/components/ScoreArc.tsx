"use client";

import { scoreArcColor } from "@/lib/scoring";

export default function ScoreArc({
  label,
  tagline,
  current,
  target,
  size = "default",
}: {
  label: string;
  tagline?: string;
  current: number;
  target: number;
  size?: "mini" | "default";
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

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl p-4 text-center border border-dark-border/50">
      <div className="relative inline-block">
        <svg width="100" height="100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#333"
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
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div>
            <div className={`text-lg font-bold ${text}`}>{current}</div>
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
