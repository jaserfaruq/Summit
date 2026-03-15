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
  hike: "bg-recovery-green text-white",
  trail_run: "bg-test-blue text-white",
  alpine_climb: "bg-burnt-orange text-white",
  rock_climb: "bg-burnt-orange text-white",
  mountaineering: "bg-forest text-white",
  scramble: "bg-sage text-white",
  backpacking: "bg-recovery-green text-white",
};

const DIMENSION_COLORS: Record<string, string> = {
  cardio: "bg-test-blue/15 text-test-blue border-test-blue/30",
  strength: "bg-burnt-orange/15 text-burnt-orange border-burnt-orange/30",
  climbing_technical: "bg-forest/15 text-forest border-forest/30",
  flexibility: "bg-sage/20 text-sage border-sage/40",
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch objectives
    const { data: objData } = await supabase
      .from("objectives")
      .select("*")
      .order("target_date");
    if (objData) setObjectives(objData as Objective[]);

    // Fetch active plan + weekly targets
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

    // Fetch workout logs
    const { data: logData } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", user.id);
    if (logData) setWorkoutLogs(logData as WorkoutLog[]);
  }

  // Distribute sessions across the days of each week
  function distributeSessionsToDates(weeks: WeeklyTarget[], planId: string): CalendarSession[] {
    const results: CalendarSession[] = [];

    for (const week of weeks) {
      if (!week.sessions || week.sessions.length === 0) continue;

      const weekStart = new Date(week.week_start + "T00:00:00");
      const sessionCount = week.sessions.length;

      // Distribute sessions across the week, leaving at least 1 rest day
      // Spread evenly: for 5 sessions in 7 days, use days 0,1,2,3,4 (Mon-Fri pattern)
      const availableDays = Math.min(6, 7); // max 6 training days
      const spacing = sessionCount <= 1 ? 1 : Math.floor(availableDays / sessionCount);

      for (let i = 0; i < sessionCount; i++) {
        const dayOffset = Math.min(i * spacing, 6); // keep within the week
        const sessionDate = new Date(weekStart);
        sessionDate.setDate(sessionDate.getDate() + dayOffset);
        const dateStr = sessionDate.toISOString().split("T")[0];

        results.push({
          date: dateStr,
          session: week.sessions[i],
          weekNumber: week.week_number,
          weekType: week.week_type,
          planId,
        });
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
    const dateStr = formatDateStr(day);
    const dayObjectives = getObjectivesForDate(day);
    if (dayObjectives.length > 0) {
      setSelectedObjective(dayObjectives[0]);
      setShowModal(true);
    } else {
      setSelectedDate(dateStr);
      setShowModal(true);
    }
  }

  function handleSaved() {
    setShowModal(false);
    setSelectedObjective(null);
    setSelectedDate(null);
    fetchData();
  }

  // Mobile: list view
  if (isMobile) {
    // Build a combined day-by-day list for the current month
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
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-1 hover:bg-sage/10 rounded">←</button>
            <h2 className="text-xl font-bold text-forest">{MONTHS[month]} {year}</h2>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-1 hover:bg-sage/10 rounded">→</button>
          </div>
          <button
            onClick={() => { setSelectedDate(new Date().toISOString().split("T")[0]); setShowModal(true); }}
            className="bg-burnt-orange text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            + Add
          </button>
        </div>

        {monthDays.length === 0 && (
          <p className="text-sage text-center py-8">No workouts or objectives this month.</p>
        )}

        <div className="space-y-2">
          {monthDays.map(({ day, objectives: dayObjs, sessions: daySessions, logs: dayLogs }) => {
            const dateStr = formatDateStr(day);
            const dayDate = new Date(dateStr + "T00:00:00");
            const dayName = DAYS[dayDate.getDay()];
            const loggedSessionNames = dayLogs.map(l => l.session_name);

            return (
              <div key={day} className="bg-white rounded-lg border border-sage/20 p-3">
                <div className="text-xs text-sage font-semibold mb-1.5">{dayName}, {MONTHS[month]} {day}</div>

                {dayObjs.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => { setSelectedObjective(obj); setShowModal(true); }}
                    className={`w-full text-left text-xs px-2 py-1 rounded mb-1 ${TYPE_COLORS[obj.type] || "bg-gray-200"}`}
                  >
                    {obj.name}
                  </button>
                ))}

                {daySessions.map((cs, i) => {
                  const isLogged = loggedSessionNames.includes(cs.session.name);
                  return (
                    <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded mb-1 border ${
                      isLogged ? "bg-recovery-green/10 border-recovery-green/30 line-through opacity-60" : DIMENSION_COLORS[cs.session.dimension] || "bg-gray-50 border-gray-200"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {cs.session.isBenchmarkSession && <span className="text-test-blue">★</span>}
                        <span>{cs.session.name}</span>
                        {isLogged && <span className="text-recovery-green no-underline">✓</span>}
                      </div>
                      <span className="text-[10px] opacity-70">{cs.session.estimatedMinutes}m</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {showModal && (
          <ObjectiveModal
            date={selectedDate} objective={selectedObjective}
            onClose={() => { setShowModal(false); setSelectedObjective(null); setSelectedDate(null); }}
            onSaved={handleSaved}
          />
        )}
      </div>
    );
  }

  // Desktop: calendar view
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2 hover:bg-sage/10 rounded">←</button>
          <h2 className="text-2xl font-bold text-forest">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 hover:bg-sage/10 rounded">→</button>
        </div>
        <button
          onClick={() => { setSelectedDate(new Date().toISOString().split("T")[0]); setShowModal(true); }}
          className="bg-burnt-orange text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-burnt-orange/90"
        >
          + Add Objective
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-sage/20 overflow-hidden">
        <div className="grid grid-cols-7">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-3 text-center text-xs font-semibold text-sage border-b border-sage/10">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) {
              return <div key={i} className="min-h-[90px] p-1 border-b border-r border-sage/10" />;
            }

            const dayObjs = getObjectivesForDate(day);
            const daySessions = getSessionsForDate(day);
            const dayLogs = getLogsForDate(day);
            const loggedSessionNames = dayLogs.map(l => l.session_name);
            const isToday = new Date().toISOString().split("T")[0] === formatDateStr(day);
            // Get week type for this day (from first session if available)
            const weekType = daySessions.length > 0 ? daySessions[0].weekType : null;

            return (
              <div
                key={i}
                className={`min-h-[90px] p-1 border-b border-r border-sage/10 cursor-pointer hover:bg-sage/5 ${
                  isToday ? "bg-forest/5" : ""
                }`}
                onClick={() => handleDayClick(day)}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-xs ${isToday ? "font-bold text-forest" : "text-gray-500"}`}>{day}</span>
                  {weekType && daySessions.findIndex(s => s.date === formatDateStr(day)) === 0 && (
                    <WeekBadge type={weekType as "test" | "recovery" | "regular" | "taper"} />
                  )}
                </div>

                {/* Objectives */}
                {dayObjs.map((obj) => (
                  <div
                    key={obj.id}
                    className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate font-semibold ${TYPE_COLORS[obj.type] || "bg-gray-200"}`}
                  >
                    {obj.name}
                  </div>
                ))}

                {/* Sessions */}
                {daySessions.map((cs, j) => {
                  const isLogged = loggedSessionNames.includes(cs.session.name);
                  return (
                    <Link
                      key={j}
                      href={`/log?session=${encodeURIComponent(cs.session.name)}&planId=${cs.planId}&week=${cs.weekNumber}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`block text-[10px] px-1 py-0.5 rounded mb-0.5 truncate border ${
                        isLogged
                          ? "bg-recovery-green/10 border-recovery-green/30 line-through opacity-60"
                          : DIMENSION_COLORS[cs.session.dimension] || "bg-gray-50 border-gray-200"
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
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-sage/20 p-5">
          <h3 className="font-semibold text-forest mb-3">All Objectives</h3>
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
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-sage/5"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${TYPE_COLORS[obj.type] || "bg-gray-200"}`}>
                      {obj.type.replace("_", " ")}
                    </span>
                    <span className="font-medium text-sm text-forest">{obj.name}</span>
                    <TierBadgeSmall tier={obj.tier} />
                  </div>
                  <span className="text-xs text-sage">{objDate.toLocaleDateString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <ObjectiveModal
          date={selectedDate} objective={selectedObjective}
          onClose={() => { setShowModal(false); setSelectedObjective(null); setSelectedDate(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function TierBadgeSmall({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    gold: "bg-yellow-100 text-yellow-800",
    silver: "bg-gray-100 text-gray-700",
    bronze: "bg-orange-100 text-orange-800",
  };
  return (
    <span className={`ml-2 inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded ${colors[tier] || colors.bronze}`}>
      {tier}
    </span>
  );
}
