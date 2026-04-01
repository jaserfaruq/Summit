"use client";

import { useState, useRef, useEffect } from "react";
import { usePlanSwitcher } from "@/lib/plan-switcher-context";

const TYPE_LABELS: Record<string, string> = {
  hike: "Hike",
  trail_run: "Trail Run",
  alpine_climb: "Alpine",
  rock_climb: "Rock Climb",
  mountaineering: "Mountaineering",
  scramble: "Scramble",
  backpacking: "Backpacking",
};

const TYPE_DOT_COLORS: Record<string, string> = {
  hike: "bg-green-500",
  trail_run: "bg-blue-500",
  alpine_climb: "bg-burnt-orange",
  rock_climb: "bg-burnt-orange",
  mountaineering: "bg-yellow-500",
  scramble: "bg-gray-400",
  backpacking: "bg-green-500",
};

export default function PlanSwitcher() {
  const { activePlanId, plans, setActivePlanId, isLoading } = usePlanSwitcher();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (isLoading || plans.length <= 1) return null;

  const activePlan = plans.find((p) => p.id === activePlanId);
  const displayName = activePlan?.objective_name || "Select Plan";

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-dark-muted hover:text-white hover:bg-white/5 transition-colors max-w-[180px]"
      >
        <span className="truncate">{displayName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden animate-scale-in origin-top-right z-50">
          <div className="px-3 py-2 border-b border-dark-border/50">
            <p className="text-xs font-medium text-dark-muted uppercase tracking-wider">Active Plans</p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {plans.map((plan) => {
              const isActive = plan.id === activePlanId;
              return (
                <button
                  key={plan.id}
                  onClick={() => {
                    setActivePlanId(plan.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors ${
                    isActive
                      ? "bg-white/5"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT_COLORS[plan.objective_type] || "bg-gray-400"}`} />
                      <span className={`text-sm font-medium truncate ${isActive ? "text-white" : "text-dark-text"}`}>
                        {plan.objective_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 ml-4">
                      <span className="text-xs text-dark-muted">
                        {TYPE_LABELS[plan.objective_type] || plan.objective_type}
                      </span>
                      <span className="text-xs text-dark-muted/50">-</span>
                      <span className="text-xs text-dark-muted">
                        {formatDate(plan.target_date)}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-burnt-orange shrink-0 mt-0.5"
                    >
                      <path d="M3 8.5l3 3 7-7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
