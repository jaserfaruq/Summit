"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Objective, ObjectiveType } from "@/lib/types";
import ObjectiveModal from "@/components/ObjectiveModal";

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

export default function CalendarPage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
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
    fetchObjectives();
  }, []);

  async function fetchObjectives() {
    const supabase = createClient();
    const { data } = await supabase
      .from("objectives")
      .select("*")
      .order("target_date");
    if (data) setObjectives(data as Objective[]);
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  function getObjectivesForDate(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return objectives.filter((o) => o.target_date === dateStr);
  }

  function handleDayClick(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayObjectives = getObjectivesForDate(day);
    if (dayObjectives.length > 0) {
      setSelectedObjective(dayObjectives[0]);
    } else {
      setSelectedDate(dateStr);
    }
    setShowModal(true);
  }

  function handleSaved() {
    setShowModal(false);
    setSelectedObjective(null);
    setSelectedDate(null);
    fetchObjectives();
  }

  // Mobile: list view
  if (isMobile) {
    const sortedObjectives = [...objectives].sort(
      (a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
    );

    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-forest">Objectives</h2>
          <button
            onClick={() => {
              setSelectedDate(new Date().toISOString().split("T")[0]);
              setShowModal(true);
            }}
            className="bg-burnt-orange text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Add Objective
          </button>
        </div>

        {sortedObjectives.length === 0 && (
          <p className="text-sage text-center py-8">No objectives yet. Add one to get started!</p>
        )}

        <div className="space-y-3">
          {sortedObjectives.map((obj) => (
            <button
              key={obj.id}
              onClick={() => {
                setSelectedObjective(obj);
                setShowModal(true);
              }}
              className="w-full text-left bg-white rounded-lg p-4 shadow-sm border border-sage/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-forest">{obj.name}</span>
                  <span className={`ml-2 inline-block px-2 py-0.5 text-xs font-semibold rounded ${TYPE_COLORS[obj.type] || "bg-gray-200"}`}>
                    {obj.type.replace("_", " ")}
                  </span>
                  <TierBadgeSmall tier={obj.tier} />
                </div>
                <span className="text-sm text-sage">{new Date(obj.target_date).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>

        {showModal && (
          <ObjectiveModal
            date={selectedDate}
            objective={selectedObjective}
            onClose={() => {
              setShowModal(false);
              setSelectedObjective(null);
              setSelectedDate(null);
            }}
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
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1))}
            className="p-2 hover:bg-sage/10 rounded"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold text-forest">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1))}
            className="p-2 hover:bg-sage/10 rounded"
          >
            →
          </button>
        </div>
        <button
          onClick={() => {
            setSelectedDate(new Date().toISOString().split("T")[0]);
            setShowModal(true);
          }}
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
          {days.map((day, i) => (
            <div
              key={i}
              className={`min-h-[80px] p-1 border-b border-r border-sage/10 ${
                day ? "cursor-pointer hover:bg-sage/5" : ""
              }`}
              onClick={() => day && handleDayClick(day)}
            >
              {day && (
                <>
                  <div className="text-xs text-gray-500 mb-1">{day}</div>
                  {getObjectivesForDate(day).map((obj) => (
                    <div
                      key={obj.id}
                      className={`text-xs px-1 py-0.5 rounded mb-0.5 truncate ${TYPE_COLORS[obj.type] || "bg-gray-200"}`}
                    >
                      {obj.name}
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <ObjectiveModal
          date={selectedDate}
          objective={selectedObjective}
          onClose={() => {
            setShowModal(false);
            setSelectedObjective(null);
            setSelectedDate(null);
          }}
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
