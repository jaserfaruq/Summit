"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { usePlanSwitcher } from "@/lib/plan-switcher-context";
import { ScoreHistory, Objective, WeeklyTarget } from "@/lib/types";

const CHANGE_REASON_LABELS: Record<string, string> = {
  assessment: "Assessment",
  weekly_rating: "Weekly rating",
  rebalance: "Rebalance",
};

const CHART_WIDTH = 800;
const CHART_HEIGHT = 360;
const PADDING = { top: 40, right: 25, bottom: 70, left: 70 };
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

type ExpectedScoreKey = "cardio" | "strength" | "climbing_technical" | "flexibility";

function DimensionChart({
  scoreHistory,
  weeklyTargets,
  dimensionKey,
  expectedScoreKey,
  label,
  color,
  target,
}: {
  scoreHistory: ScoreHistory[];
  weeklyTargets: WeeklyTarget[];
  dimensionKey: "cardio_score" | "strength_score" | "climbing_score" | "flexibility_score";
  expectedScoreKey: ExpectedScoreKey;
  label: string;
  color: string;
  target: number;
}) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);

  const handlePointEnter = useCallback((idx: number, clientX: number, clientY: number, rect: DOMRect) => {
    setTooltip({ idx, x: clientX - rect.left, y: clientY - rect.top });
  }, []);

  const handlePointLeave = useCallback(() => setTooltip(null), []);
  // Build time-based X scale from both data sources
  // Use a visible window: from first data point to a reasonable horizon
  // so early data isn't squished when the trajectory extends months out
  const scoreDates = scoreHistory.map((p) => new Date(p.week_ending).getTime());
  const trajectoryDates = weeklyTargets.map((w) => new Date(w.week_start).getTime());
  const allTimestamps = [...scoreDates, ...trajectoryDates];
  const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0;
  const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0;

  // If actual data covers a small fraction of the trajectory, extend the visible
  // window to ~3x the actual data range or 6 weeks minimum, so points aren't squished
  const latestActual = scoreDates.length > 0 ? Math.max(...scoreDates) : minTime;
  const actualRange = latestActual - minTime;
  const sixWeeks = 6 * 7 * 24 * 60 * 60 * 1000;
  const visibleMax = Math.min(
    maxTime,
    Math.max(latestActual + Math.max(actualRange * 2, sixWeeks), minTime + sixWeeks)
  );
  const timeRange = visibleMax - minTime;

  function dateToX(dateStr: string): number {
    if (timeRange === 0) return PADDING.left + PLOT_WIDTH / 2;
    const t = new Date(dateStr).getTime();
    // Clamp to visible area
    const clamped = Math.min(Math.max(t, minTime), visibleMax);
    return PADDING.left + ((clamped - minTime) / timeRange) * PLOT_WIDTH;
  }

  // Compute dynamic Y-axis range from data + trajectory + target
  const trajectoryValues = weeklyTargets.map((w) => w.expected_scores[expectedScoreKey]);
  const allValues = [
    ...scoreHistory.map((p) => p[dimensionKey]),
    ...trajectoryValues,
    target,
  ];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = rawMax - rawMin;
  const buffer = Math.max(range * 0.1, 5);
  const yMin = Math.max(0, Math.floor((rawMin - buffer) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((rawMax + buffer) / 5) * 5);
  const yRange = yMax - yMin || 10;

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

  // Actual score path
  const pathData =
    scoreHistory.length >= 2
      ? scoreHistory
          .map((point, i) => `${i === 0 ? "M" : "L"} ${dateToX(point.week_ending)} ${yScale(point[dimensionKey])}`)
          .join(" ")
      : null;

  // Expected trajectory path
  const trajectoryPath =
    weeklyTargets.length >= 2
      ? weeklyTargets
          .map((w, i) => `${i === 0 ? "M" : "L"} ${dateToX(w.week_start)} ${yScale(w.expected_scores[expectedScoreKey])}`)
          .join(" ")
      : null;

  return (
    <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-4">
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-lg font-semibold text-white">{label}</h3>
        </div>
        <span className="text-xs text-dark-muted">Target: {target}</span>
      </div>
      {/* Legend */}
      {weeklyTargets.length >= 2 && (
        <div className="flex items-center gap-4 mb-1 ml-5">
          <div className="flex items-center gap-1.5">
            <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="2" /></svg>
            <span className="text-xs text-dark-muted">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" /></svg>
            <span className="text-xs text-dark-muted">Target Trajectory</span>
          </div>
        </div>
      )}
      <div className="overflow-x-auto relative" onMouseLeave={handlePointLeave}>
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" style={{ minWidth: 280 }}>
          {/* Y-axis labels & grid */}
          {gridLines.map((v) => (
            <g key={v}>
              <text x={PADDING.left - 10} y={yScale(v) + 5} textAnchor="end" fontSize="20" fill="#7a8f82">
                {v}
              </text>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={yScale(v)}
                y2={yScale(v)}
                stroke="#2d3b33"
                strokeWidth={1}
              />
            </g>
          ))}

          {/* Target line (solid) */}
          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={yScale(target)}
            y2={yScale(target)}
            stroke={color}
            strokeWidth={2}
            opacity={0.6}
          />
          <text
            x={CHART_WIDTH - PADDING.right - 4}
            y={yScale(target) - 8}
            textAnchor="end"
            fontSize="16"
            fill={color}
            opacity={0.8}
            fontWeight="600"
          >
            Target: {target}
          </text>

          {/* Expected trajectory line */}
          {trajectoryPath && (
            <path
              d={trajectoryPath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.45}
            />
          )}

          {/* Data line */}
          {pathData && (
            <path d={pathData} fill="none" stroke={color} strokeWidth={2.5} />
          )}

          {/* Data points — interactive with expanded touch targets */}
          {scoreHistory.map((point, i) => (
            <g key={i}>
              {/* Invisible larger hit area for touch */}
              <circle
                cx={dateToX(point.week_ending)}
                cy={yScale(point[dimensionKey])}
                r={16}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGCircleElement).closest("div")!.getBoundingClientRect();
                  handlePointEnter(i, e.clientX, rect.top < e.clientY ? e.clientY : rect.top, rect);
                }}
                onMouseLeave={handlePointLeave}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  const rect = (e.target as SVGCircleElement).closest("div")!.getBoundingClientRect();
                  handlePointEnter(i, touch.clientX, touch.clientY, rect);
                }}
              />
              {/* Visible dot — hollow ring for test weeks, solid for regular */}
              <circle
                cx={dateToX(point.week_ending)}
                cy={yScale(point[dimensionKey])}
                r={point.is_test_week ? 6 : 5}
                fill={point.is_test_week ? "none" : color}
                stroke={point.is_test_week ? color : "none"}
                strokeWidth={point.is_test_week ? 2.5 : 0}
                opacity={0.9}
                className="pointer-events-none"
              />
            </g>
          ))}

          {/* Data labels — avoid overlaps by checking pixel distance */}
          {(() => {
            let lastLabelX = -Infinity;
            const minLabelGap = 40;
            return scoreHistory.map((point, i) => {
              const x = dateToX(point.week_ending);
              const isLast = i === scoreHistory.length - 1;
              // Always show last point, skip if too close to previous label
              if (!isLast && x - lastLabelX < minLabelGap) return null;
              lastLabelX = x;
              return (
                <text
                  key={`label-${i}`}
                  x={x}
                  y={yScale(point[dimensionKey]) - 14}
                  textAnchor="middle"
                  fontSize="20"
                  fill={color}
                  fontWeight="700"
                >
                  {point[dimensionKey]}
                </text>
              );
            });
          })()}

          {/* X-axis labels — avoid overlaps by checking pixel distance */}
          {(() => {
            let lastLabelX = -Infinity;
            const minGap = 80;
            return scoreHistory.map((point, i) => {
              const x = dateToX(point.week_ending);
              const isLast = i === scoreHistory.length - 1;
              if (!isLast && x - lastLabelX < minGap) return null;
              lastLabelX = x;
              return (
                <text
                  key={i}
                  x={x}
                  y={CHART_HEIGHT - 12}
                  textAnchor="middle"
                  fontSize="20"
                  fill="#7a8f82"
                >
                  {new Date(point.week_ending).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </text>
              );
            });
          })()}
        </svg>
        {/* Tooltip */}
        {tooltip !== null && (() => {
          const pt = scoreHistory[tooltip.idx];
          const prev = tooltip.idx > 0 ? scoreHistory[tooltip.idx - 1] : null;
          const score = pt[dimensionKey];
          const delta = prev ? score - prev[dimensionKey] : null;
          const reason = CHANGE_REASON_LABELS[pt.change_reason] || pt.change_reason;
          return (
            <div
              className="absolute z-20 pointer-events-none bg-dark-surface border border-dark-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-0.5"
              style={{ left: Math.min(tooltip.x, 220), top: Math.max(tooltip.y - 80, 4) }}
            >
              <div className="text-sm text-dark-text font-bold">{score}{delta !== null && <span className={delta >= 0 ? " text-emerald-400" : " text-amber-400"}> ({delta >= 0 ? "+" : ""}{delta})</span>}</div>
              <div className="text-dark-muted">{new Date(pt.week_ending).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
              <div className="text-dark-muted">{reason}{pt.is_test_week ? " · Test week" : ""}</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { activePlanId, isLoading: plansLoading } = usePlanSwitcher();
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [weeklyTargets, setWeeklyTargets] = useState<WeeklyTarget[]>([]);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    let obj: Objective | null = null;
    let planId: string | null = null;

    if (activePlanId) {
      // Fetch the plan to get its objective_id
      const { data: planData } = await supabase
        .from("training_plans")
        .select("id, objective_id")
        .eq("id", activePlanId)
        .eq("user_id", user.id)
        .single();

      if (planData) {
        planId = planData.id;
        const { data: objData } = await supabase
          .from("objectives")
          .select("*")
          .eq("id", planData.objective_id)
          .single();
        obj = objData as Objective | null;
      }
    } else {
      // Fallback: first objective by date
      const { data: objectives } = await supabase
        .from("objectives")
        .select("*")
        .eq("user_id", user.id)
        .order("target_date")
        .limit(1);
      obj = (objectives as Objective[] | null)?.[0] || null;

      if (obj) {
        const { data: plans } = await supabase
          .from("training_plans")
          .select("id")
          .eq("objective_id", obj.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        planId = plans?.[0]?.id || null;
      }
    }

    setObjective(obj);

    if (obj) {
      const { data: history } = await supabase
        .from("score_history")
        .select("*")
        .eq("objective_id", obj.id)
        .order("week_ending");

      setScoreHistory((history as ScoreHistory[]) || []);

      if (planId) {
        const { data: targets } = await supabase
          .from("weekly_targets")
          .select("id, week_number, week_start, expected_scores")
          .eq("plan_id", planId)
          .order("week_number");

        setWeeklyTargets((targets as WeeklyTarget[]) || []);
      } else {
        setWeeklyTargets([]);
      }
    } else {
      setScoreHistory([]);
      setWeeklyTargets([]);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanId]);

  useEffect(() => {
    if (!plansLoading) fetchData();
  }, [fetchData, plansLoading]);

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
        <h2 className="text-2xl font-bold text-white font-display mb-3">No Progress Data Yet</h2>
        <p className="text-white/70 mb-6 drop-shadow-md">Add an objective and start training to see your progress here.</p>
        <a href="/calendar" className="inline-block bg-burnt-orange hover:bg-burnt-orange/90 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
          Set an objective
        </a>
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
    { key: "cardio_score" as const, expectedKey: "cardio" as const, label: "Cardio", color: "#D4782F", target: targets.cardio },
    { key: "strength_score" as const, expectedKey: "strength" as const, label: "Strength", color: "#5BA3D9", target: targets.strength },
    { key: "climbing_score" as const, expectedKey: "climbing_technical" as const, label: "Climbing", color: "#B0C4A8", target: targets.climbing },
    { key: "flexibility_score" as const, expectedKey: "flexibility" as const, label: "Flexibility", color: "#C49BD4", target: targets.flexibility },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-white font-display">Progress: {objective.name}</h2>
        {objective.target_date && (
          <p className="text-sm text-white/60 mt-1">Target: {new Date(objective.target_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        )}
      </div>

      {/* Summary strip */}
      {scoreHistory.length > 0 && (() => {
        const latest = scoreHistory[scoreHistory.length - 1];
        const weeksLeft = objective.target_date
          ? Math.max(0, Math.ceil((new Date(objective.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
          : null;
        const lastWeekTarget = weeklyTargets.length > 0
          ? weeklyTargets.find((w) => {
              const wEnd = new Date(w.week_start);
              wEnd.setDate(wEnd.getDate() + 6);
              return wEnd >= new Date(latest.week_ending);
            }) ?? weeklyTargets[weeklyTargets.length - 1]
          : null;

        const summaryDims = [
          { label: "Cardio", actual: latest.cardio_score, expected: lastWeekTarget?.expected_scores?.cardio, target: targets.cardio, color: "#D4782F" },
          { label: "Strength", actual: latest.strength_score, expected: lastWeekTarget?.expected_scores?.strength, target: targets.strength, color: "#5BA3D9" },
          { label: "Climbing", actual: latest.climbing_score, expected: lastWeekTarget?.expected_scores?.climbing_technical, target: targets.climbing, color: "#B0C4A8" },
          { label: "Flexibility", actual: latest.flexibility_score, expected: lastWeekTarget?.expected_scores?.flexibility, target: targets.flexibility, color: "#C49BD4" },
        ];

        return (
          <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-dark-muted">Current Standing</span>
              {weeksLeft !== null && (
                <span className="text-sm text-dark-muted">
                  <span className="font-semibold text-dark-text">{weeksLeft}</span> week{weeksLeft !== 1 ? "s" : ""} to go
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {summaryDims.map((d) => {
                const gap = d.expected != null ? d.actual - Math.round(d.expected) : null;
                const status = gap === null ? null : gap >= 0 ? "ahead" : gap >= -3 ? "on-track" : "behind";
                return (
                  <div key={d.label} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-dark-muted">{d.label}</span>
                    </div>
                    <span className="text-lg font-semibold text-dark-text">{d.actual}<span className="text-dark-muted font-normal text-sm"> / {d.target}</span></span>
                    {status && (
                      <span className={`text-xs font-medium ${
                        status === "ahead" ? "text-emerald-400" : status === "on-track" ? "text-dark-muted" : "text-amber-400"
                      }`}>
                        {status === "ahead" ? `+${gap} ahead` : status === "on-track" ? "On track" : `${gap} behind`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {scoreHistory.length === 0 ? (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-8 text-center">
          <p className="text-dark-muted mb-4">No score history yet. Complete your first training week to see progress.</p>
          <a href="/plan" className="text-sm text-burnt-orange hover:text-burnt-orange/80 font-medium transition-colors">
            Go to your plan &rarr;
          </a>
        </div>
      ) : (
        <>
          {/* Dimension Charts — 2×2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dimensions.map((dim) => (
              <DimensionChart
                key={dim.key}
                scoreHistory={scoreHistory}
                weeklyTargets={weeklyTargets}
                dimensionKey={dim.key}
                expectedScoreKey={dim.expectedKey}
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
                  <th className="px-4 py-3 text-center text-dark-muted font-medium"><span className="hidden sm:inline">Flexibility</span><span className="sm:hidden">Flex</span></th>
                  <th className="px-4 py-3 text-left text-dark-muted font-medium hidden sm:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {scoreHistory.map((entry, i) => (
                  <tr key={entry.id} className={`border-b border-dark-border/50 ${i % 2 === 1 ? "bg-dark-surface/30" : ""} ${entry.is_test_week ? "ring-1 ring-inset ring-test-blue/30" : ""}`}>
                    <td className="px-4 py-2 text-dark-text whitespace-nowrap">
                      {new Date(entry.week_ending).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {entry.is_test_week && <span className="ml-1.5 text-xs text-test-blue font-medium">T</span>}
                    </td>
                    <td className="px-4 py-2 text-center font-mono font-semibold text-dark-text">{entry.cardio_score}</td>
                    <td className="px-4 py-2 text-center font-mono font-semibold text-dark-text">{entry.strength_score}</td>
                    <td className="px-4 py-2 text-center font-mono font-semibold text-dark-text">{entry.climbing_score}</td>
                    <td className="px-4 py-2 text-center font-mono font-semibold text-dark-text">{entry.flexibility_score}</td>
                    <td className="px-4 py-2 text-dark-muted text-xs capitalize hidden sm:table-cell">{CHANGE_REASON_LABELS[entry.change_reason] || entry.change_reason}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-forest/40 bg-forest/10">
                  <td className="px-4 py-2.5 text-forest font-semibold text-xs uppercase tracking-wide">Target</td>
                  <td className="px-4 py-2.5 text-center font-mono text-forest font-semibold">{targets.cardio}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-forest font-semibold">{targets.strength}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-forest font-semibold">{targets.climbing}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-forest font-semibold">{targets.flexibility}</td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
