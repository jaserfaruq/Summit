"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { ScoreHistory, Objective } from "@/lib/types";

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

  const chartWidth = 800;
  const chartHeight = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const maxScore = 100;
  const dataPoints = scoreHistory.length;

  function xScale(i: number) {
    if (dataPoints <= 1) return padding.left + plotWidth / 2;
    return padding.left + (i / (dataPoints - 1)) * plotWidth;
  }

  function yScale(score: number) {
    return padding.top + plotHeight - (score / maxScore) * plotHeight;
  }

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
          {/* SVG Chart */}
          <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-4 overflow-x-auto">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ minWidth: 400 }}>
              {/* Y-axis labels */}
              {[0, 25, 50, 75, 100].map((v) => (
                <g key={v}>
                  <text x={padding.left - 10} y={yScale(v) + 4} textAnchor="end" className="text-[10px]" fill="#888">
                    {v}
                  </text>
                  <line
                    x1={padding.left}
                    x2={chartWidth - padding.right}
                    y1={yScale(v)}
                    y2={yScale(v)}
                    stroke="#333"
                    strokeWidth={1}
                  />
                </g>
              ))}

              {/* Target lines (dashed) */}
              {dimensions.map((dim) => (
                <line
                  key={`target-${dim.key}`}
                  x1={padding.left}
                  x2={chartWidth - padding.right}
                  y1={yScale(dim.target)}
                  y2={yScale(dim.target)}
                  stroke={dim.color}
                  strokeWidth={1}
                  strokeDasharray="6 3"
                  opacity={0.4}
                />
              ))}

              {/* Data lines */}
              {dimensions.map((dim) => {
                if (dataPoints < 2) return null;
                const pathData = scoreHistory
                  .map((point, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(point[dim.key])}`)
                  .join(" ");
                return (
                  <path
                    key={dim.key}
                    d={pathData}
                    fill="none"
                    stroke={dim.color}
                    strokeWidth={2}
                  />
                );
              })}

              {/* Data points */}
              {dimensions.map((dim) =>
                scoreHistory.map((point, i) => (
                  <circle
                    key={`${dim.key}-${i}`}
                    cx={xScale(i)}
                    cy={yScale(point[dim.key])}
                    r={4}
                    fill={dim.color}
                    opacity={0.8}
                  />
                ))
              )}

              {/* X-axis labels */}
              {scoreHistory.map((point, i) => (
                <text
                  key={i}
                  x={xScale(i)}
                  y={chartHeight - 5}
                  textAnchor="middle"
                  className="text-[9px]"
                  fill="#888"
                >
                  {new Date(point.week_ending).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </text>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center">
            {dimensions.map((dim) => (
              <div key={dim.key} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dim.color }} />
                <span className="text-dark-text">{dim.label}</span>
                <span className="text-dark-muted text-xs">(target: {dim.target})</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6 justify-center text-xs text-dark-muted">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-dark-muted" />
              <span>Weekly score (from self-ratings)</span>
            </div>
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
