"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Objective, WeeklyTarget, TrainingPlan, PlanSession, WorkoutLog } from "@/lib/types";
import ObjectiveModal from "@/components/ObjectiveModal";
import WeekBadge from "@/components/WeekBadge";
import Link from "next/link";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_COLORS: Record<string, string> = {
  hike: "bg-hiking-green text-white",
  trail_run: "bg-test-blue text-white",
  alpine_climb: "bg-burnt-orange text-white",
  rock_climb: "bg-burnt-orange text-white",
  mountaineering: "bg-gold text-dark-bg",
  scramble: "bg-dark-muted text-white",
  backpacking: "bg-hiking-green text-white",
};

const DIMENSION_COLORS: Record<string, string> = {
  cardio: "bg-test-blue/15 text-blue-300 border-test-blue/30",
  strength: "bg-burnt-orange/15 text-orange-300 border-burnt-orange/30",
  climbing_technical: "bg-gold/15 text-gold border-gold/30",
  flexibility: "bg-dark-border text-dark-muted border-dark-border",
};

interface CalendarSession {
  date: string;
  session: PlanSession;
  weekNumber: number;
  weekType: string;
  planId: string;
}

export default function CalendarPage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [calendarSessions, setCalendarSessions] = useState<CalendarSession[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: objData } = await supabase
      .from("objectives")
      .select("*")
      .order("target_date");
    if (objData) setObjectives(objData as Objective[]);

    const { data: plans } = await supabase
      .from("training_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    const activePlan = (plans as TrainingPlan[] | null)?.[0];
    if (activePlan) {
      const { data: weekData } = await supabase
        .from("weekly_targets")
        .select("*")
        .eq("plan_id", activePlan.id)
        .order("week_number");

      if (weekData) {
        const sessions = distributeSessionsToDates(weekData as WeeklyTarget[], activePlan.id);
        setCalendarSessions(sessions);
      }
    }

    const { data: logData } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", user.id);
    if (logData) setWorkoutLogs(logData as WorkoutLog[]);
  }

  function distributeSessionsToDates(weeks: WeeklyTarget[], planId: string): CalendarSession[] {
    const results: CalendarSession[] = [];
    for (const week of weeks) {
      if (!week.sessions || week.sessions.length === 0) continue;
      const weekStart = new Date(week.week_start + "T00:00:00");
      const sessionCount = week.sessions.length;
      const availableDays = Math.min(6, 7);
      const spacing = sessionCount <= 1 ? 1 : Math.floor(availableDays / sessionCount);

      for (let i = 0; i < sessionCount; i++) {
        const dayOffset = Math.min(i * spacing, 6);
        const sessionDate = new Date(weekStart);
        sessionDate.setDate(sessionDate.getDate() + dayOffset);
        const dateStr = sessionDate.toISOString().split("T")[0];
        results.push({ date: dateStr, session: week.sessions[i], weekNumber: week.week_number, weekType: week.week_type, planId });
      }
    }
    return results;
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  function formatDateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getObjectivesForDate(day: number) {
    const dateStr = formatDateStr(day);
    return objectives.filter((o) => o.target_date?.substring(0, 10) === dateStr);
  }

  function getSessionsForDate(day: number) {
    const dateStr = formatDateStr(day);
    return calendarSessions.filter((s) => s.date === dateStr);
  }

  function getLogsForDate(day: number) {
    const dateStr = formatDateStr(day);
    return workoutLogs.filter((l) => l.logged_date?.substring(0, 10) === dateStr);
  }

  function handleDayClick(day: number) {
    const dayObjectives = getObjectivesForDate(day);
    if (dayObjectives.length > 0) {
      setSelectedObjective(dayObjectives[0]);
      setShowModal(true);
    } else {
      setSelectedDate(formatDateStr(day));
      setShowModal(true);
    }
  }

  function handleSaved() {
    setShowModal(false);
    setSelectedObjective(null);
    setSelectedDate(null);
    fetchData();
  }

  // Build mobile list data
  const monthDays: { day: number; objectives: Objective[]; sessions: CalendarSession[]; logs: WorkoutLog[] }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const objs = getObjectivesForDate(d);
    const sess = getSessionsForDate(d);
    const logs = getLogsForDate(d);
    if (objs.length > 0 || sess.length > 0 || logs.length > 0) {
      monthDays.push({ day: d, objectives: objs, sessions: sess, logs: logs });
    }
  }

  return (
    <>
    {/* Mobile: list view */}
    <div className="md:hidden px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2.5 hover:bg-dark-card rounded text-white/60">←</button>
          <h2 className="text-xl font-bold text-white">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2.5 hover:bg-dark-card rounded text-white/60">→</button>
        </div>
        <button
          onClick={() => { setSelectedDate(new Date().toISOString().split("T")[0]); setShowModal(true); }}
          className="bg-gold text-dark-bg px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          + Add
        </button>
      </div>

      {monthDays.length === 0 && (
        <p className="text-white/60 text-center py-8">No workouts or objectives this month.</p>
      )}

      <div className="space-y-2">
        {monthDays.map(({ day, objectives: dayObjs, sessions: daySessions, logs: dayLogs }) => {
          const dateStr = formatDateStr(day);
          const dayDate = new Date(dateStr + "T00:00:00");
          const dayName = DAYS[dayDate.getDay()];
          const loggedSessionNames = dayLogs.map(l => l.session_name);

          return (
            <div key={day} className="bg-dark-card/80 backdrop-blur-sm rounded-lg border border-dark-border/50 p-3">
              <div className="text-xs text-dark-muted font-semibold mb-1.5">{dayName}, {MONTHS[month]} {day}</div>

              {dayObjs.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => { setSelectedObjective(obj); setShowModal(true); }}
                  className={`w-full text-left text-xs px-2 py-1 rounded mb-1 ${TYPE_COLORS[obj.type] || "bg-dark-border"}`}
                >
                  {obj.name}
                </button>
              ))}

              {daySessions.map((cs, i) => {
                const isLogged = loggedSessionNames.includes(cs.session.name);
                return (
                  <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded mb-1 border ${
                    isLogged ? "bg-green-900/20 border-green-800/40 line-through opacity-60" : DIMENSION_COLORS[cs.session.dimension] || "bg-dark-surface border-dark-border"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {cs.session.isBenchmarkSession && <span className="text-blue-300">★</span>}
                      <span>{cs.session.name}</span>
                      {isLogged && <span className="text-green-400 no-underline">✓</span>}
                    </div>
                    <span className="text-[10px] opacity-70">{cs.session.estimatedMinutes}m</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>

    {/* Desktop: calendar view */}
    <div className="hidden md:block max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2.5 hover:bg-dark-card rounded text-white/60">←</button>
          <h2 className="text-2xl font-bold text-white">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2.5 hover:bg-dark-card rounded text-white/60">→</button>
        </div>
        <button
          onClick={() => { setSelectedDate(new Date().toISOString().split("T")[0]); setShowModal(true); }}
          className="bg-gold text-dark-bg px-4 py-2 rounded-lg text-sm font-medium hover:bg-gold/90"
        >
          + Add Objective
        </button>
      </div>

      <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 overflow-hidden">
        <div className="grid grid-cols-7">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-3 text-center text-xs font-semibold text-dark-muted border-b border-dark-border">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) {
              return <div key={i} className="min-h-[90px] p-1 border-b border-r border-dark-border/50" />;
            }

            const dayObjs = getObjectivesForDate(day);
            const daySessions = getSessionsForDate(day);
            const dayLogs = getLogsForDate(day);
            const loggedSessionNames = dayLogs.map(l => l.session_name);
            const isToday = new Date().toISOString().split("T")[0] === formatDateStr(day);
            const weekType = daySessions.length > 0 ? daySessions[0].weekType : null;

            return (
              <div
                key={i}
                className={`min-h-[90px] p-1 border-b border-r border-dark-border/50 cursor-pointer hover:bg-dark-surface ${
                  isToday ? "bg-gold/5" : ""
                }`}
                onClick={() => handleDayClick(day)}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-xs ${isToday ? "font-bold text-gold" : "text-dark-muted"}`}>{day}</span>
                  {weekType && daySessions.findIndex(s => s.date === formatDateStr(day)) === 0 && (
                    <WeekBadge type={weekType as "test" | "regular" | "taper"} />
                  )}
                </div>

                {dayObjs.map((obj) => (
                  <div
                    key={obj.id}
                    className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate font-semibold ${TYPE_COLORS[obj.type] || "bg-dark-border"}`}
                  >
                    {obj.name}
                  </div>
                ))}

                {daySessions.map((cs, j) => {
                  const isLogged = loggedSessionNames.includes(cs.session.name);
                  return (
                    <Link
                      key={j}
                      href={`/log?session=${encodeURIComponent(cs.session.name)}&planId=${cs.planId}&week=${cs.weekNumber}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`block text-[10px] px-1 py-0.5 rounded mb-0.5 truncate border ${
                        isLogged
                          ? "bg-green-900/20 border-green-800/40 line-through opacity-60"
                          : DIMENSION_COLORS[cs.session.dimension] || "bg-dark-surface border-dark-border"
                      }`}
                    >
                      {cs.session.isBenchmarkSession && "★ "}
                      {cs.session.name}
                      {isLogged && " ✓"}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* All Objectives list below calendar */}
      {objectives.length > 0 && (
        <div className="mt-6 bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-5">
          <h3 className="font-semibold text-white mb-3">All Objectives</h3>
          <div className="space-y-2">
            {objectives.map((obj) => {
              const objDate = new Date(obj.target_date);
              return (
                <button
                  key={obj.id}
                  onClick={() => {
                    setCurrentDate(new Date(objDate.getFullYear(), objDate.getMonth()));
                    setSelectedObjective(obj);
                    setShowModal(true);
                  }}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-dark-surface"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${TYPE_COLORS[obj.type] || "bg-dark-border"}`}>
                      {obj.type.replace("_", " ")}
                    </span>
                    <span className="font-medium text-sm text-white">{obj.name}</span>
                    <TierBadgeSmall tier={obj.tier} />
                  </div>
                  <span className="text-xs text-dark-muted">{objDate.toLocaleDateString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>

    {showModal && (
      <ObjectiveModal
        date={selectedDate} objective={selectedObjective}
        onClose={() => { setShowModal(false); setSelectedObjective(null); setSelectedDate(null); }}
        onSaved={handleSaved}
      />
    )}
    </>
  );
}

function TierBadgeSmall({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    gold: "bg-medal-gold/20 text-medal-gold",
    silver: "bg-white/10 text-white/70",
    bronze: "bg-burnt-orange/20 text-burnt-orange",
  };
  return (
    <span className={`ml-2 inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded ${colors[tier] || colors.bronze}`}>
      {tier}
    </span>
  );
}
