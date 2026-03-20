"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { ScoreHistory, Objective } from "@/lib/types";

const CHART_WIDTH = 800;
const CHART_HEIGHT = 220;
const PADDING = { top: 20, right: 20, bottom: 40, left: 50 };
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

function xScale(i: number, dataPoints: number) {
  if (dataPoints <= 1) return PADDING.left + PLOT_WIDTH / 2;
  return PADDING.left + (i / (dataPoints - 1)) * PLOT_WIDTH;
}

function DimensionChart({
  scoreHistory,
  dimensionKey,
  label,
  color,
  target,
}: {
  scoreHistory: ScoreHistory[];
  dimensionKey: "cardio_score" | "strength_score" | "climbing_score" | "flexibility_score";
  label: string;
  color: string;
  target: number;
}) {
  const dataPoints = scoreHistory.length;

  // Compute dynamic Y-axis range from data + target
  const allValues = [...scoreHistory.map((p) => p[dimensionKey]), target];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = rawMax - rawMin;
  const buffer = Math.max(range * 0.1, 5);
  const yMin = Math.max(0, Math.floor((rawMin - buffer) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((rawMax + buffer) / 5) * 5);
  const yRange = yMax - yMin || 10; // fallback if all values identical

  function yScale(score: number) {
    return PADDING.top + PLOT_HEIGHT - ((score - yMin) / yRange) * PLOT_HEIGHT;
  }

  // Generate ~4-5 evenly spaced grid lines at multiples of 5
  const gridStep = Math.max(5, Math.round(yRange / 4 / 5) * 5) || 5;
  const gridLines: number[] = [];
  for (let v = yMin; v <= yMax; v += gridStep) {
    gridLines.push(v);
  }
  if (gridLines[gridLines.length - 1] !== yMax) {
    gridLines.push(yMax);
  }

  const pathData =
    dataPoints >= 2
      ? scoreHistory
          .map((point, i) => `${i === 0 ? "M" : "L"} ${xScale(i, dataPoints)} ${yScale(point[dimensionKey])}`)
          .join(" ")
      : null;

  return (
    <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-white">{label}</h3>
        </div>
        <span className="text-xs text-dark-muted">Target: {target}</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" style={{ minWidth: 300 }}>
          {/* Y-axis labels & grid */}
          {gridLines.map((v) => (
            <g key={v}>
              <text x={PADDING.left - 10} y={yScale(v) + 4} textAnchor="end" className="text-[10px]" fill="#888">
                {v}
              </text>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={yScale(v)}
                y2={yScale(v)}
                stroke="#333"
                strokeWidth={1}
              />
            </g>
          ))}

          {/* Target line (dashed) */}
          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={yScale(target)}
            y2={yScale(target)}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="6 3"
            opacity={0.4}
          />

          {/* Data line */}
          {pathData && (
            <path d={pathData} fill="none" stroke={color} strokeWidth={2} />
          )}

          {/* Data points */}
          {scoreHistory.map((point, i) => (
            <circle
              key={i}
              cx={xScale(i, dataPoints)}
              cy={yScale(point[dimensionKey])}
              r={4}
              fill={color}
              opacity={0.8}
            />
          ))}

          {/* X-axis labels */}
          {scoreHistory.map((point, i) => (
            <text
              key={i}
              x={xScale(i, dataPoints)}
              y={CHART_HEIGHT - 5}
              textAnchor="middle"
              className="text-[9px]"
              fill="#888"
            >
              {new Date(point.week_ending).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: objectives } = await supabase
      .from("objectives")
      .select("*")
      .eq("user_id", user.id)
      .order("target_date")
      .limit(1);

    const obj = (objectives as Objective[] | null)?.[0];
    setObjective(obj || null);

    if (obj) {
      const { data: history } = await supabase
        .from("score_history")
        .select("*")
        .eq("objective_id", obj.id)
        .order("week_ending");

      setScoreHistory((history as ScoreHistory[]) || []);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-border rounded w-1/3" />
          <div className="h-64 bg-dark-border rounded" />
        </div>
      </div>
    );
  }

  if (!objective) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">No Progress Data Yet</h2>
        <p className="text-dark-muted">Add an objective and start training to see your progress here.</p>
      </div>
    );
  }

  const targets = {
    cardio: objective.target_cardio_score,
    strength: objective.target_strength_score,
    climbing: objective.target_climbing_score,
    flexibility: objective.target_flexibility_score,
  };

  const dimensions = [
    { key: "cardio_score" as const, label: "Cardio", color: "#ef4444", target: targets.cardio },
    { key: "strength_score" as const, label: "Strength", color: "#3b82f6", target: targets.strength },
    { key: "climbing_score" as const, label: "Climbing", color: "#f59e0b", target: targets.climbing },
    { key: "flexibility_score" as const, label: "Flexibility", color: "#22c55e", target: targets.flexibility },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold text-white">Progress: {objective.name}</h2>

      {scoreHistory.length === 0 ? (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-8 text-center">
          <p className="text-dark-muted">No score history yet. Complete your first training week to see progress.</p>
        </div>
      ) : (
        <>
          {/* Dimension Charts — 2×2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dimensions.map((dim) => (
              <DimensionChart
                key={dim.key}
                scoreHistory={scoreHistory}
                dimensionKey={dim.key}
                label={dim.label}
                color={dim.color}
                target={dim.target}
              />
            ))}
          </div>

          {/* Score table */}
          <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="px-4 py-3 text-left text-dark-muted font-medium">Week</th>
                  <th className="px-4 py-3 text-center text-dark-muted font-medium">Cardio</th>
                  <th className="px-4 py-3 text-center text-dark-muted font-medium">Strength</th>
                  <th className="px-4 py-3 text-center text-dark-muted font-medium">Climbing</th>
                  <th className="px-4 py-3 text-center text-dark-muted font-medium">Flexibility</th>
                </tr>
              </thead>
              <tbody>
                {scoreHistory.map((entry) => (
                  <tr key={entry.id} className="border-b border-dark-border/50">
                    <td className="px-4 py-2 text-dark-text">{new Date(entry.week_ending).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-center font-mono text-dark-text">{entry.cardio_score}</td>
                    <td className="px-4 py-2 text-center font-mono text-dark-text">{entry.strength_score}</td>
                    <td className="px-4 py-2 text-center font-mono text-dark-text">{entry.climbing_score}</td>
                    <td className="px-4 py-2 text-center font-mono text-dark-text">{entry.flexibility_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
