"use client";

import { scoreArcColor } from "@/lib/scoring";

export default function ScoreArc({
  label,
  tagline,
  current,
  target,
}: {
  label: string;
  tagline: string;
  current: number;
  target: number;
}) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const color = scoreArcColor(current, target);
  const colorMap = {
    green: { stroke: "#22c55e", bg: "bg-green-50", text: "text-green-700" },
    yellow: { stroke: "#eab308", bg: "bg-yellow-50", text: "text-yellow-700" },
    red: { stroke: "#ef4444", bg: "bg-red-50", text: "text-red-700" },
  };
  const { stroke, bg, text } = colorMap[color];

  // SVG arc parameters
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`${bg} rounded-xl p-4 text-center`}>
      <div className="relative inline-block">
        <svg width="100" height="100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
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
            <div className="text-xs text-gray-400">/ {target}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 font-semibold text-forest text-sm">{label}</div>
      {tagline && (
        <div className="text-xs text-sage mt-0.5 italic">{tagline}</div>
      )}
    </div>
  );
}
