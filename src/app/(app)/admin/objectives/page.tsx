"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { ValidatedObjective, ObjectiveType, Difficulty } from "@/lib/types";

export default function AdminObjectivesPage() {
  const [objectives, setObjectives] = useState<ValidatedObjective[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [editing, setEditing] = useState<ValidatedObjective | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isValidator, setIsValidator] = useState(false);

  useEffect(() => {
    checkValidator();
    fetchObjectives();
  }, []);

  async function checkValidator() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_validator")
      .eq("id", user.id)
      .single();
    setIsValidator(profile?.is_validator || false);
  }

  async function fetchObjectives() {
    const supabase = createClient();
    const { data } = await supabase
      .from("validated_objectives")
      .select("*")
      .order("name");
    setObjectives((data as ValidatedObjective[]) || []);
    setLoading(false);
  }

  if (!isValidator && !loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-forest mb-4">Access Denied</h2>
        <p className="text-sage">This page is only available to validators.</p>
      </div>
    );
  }

  const filtered = objectives.filter((o) => {
    const matchesSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.route.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || o.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-forest">Validated Objectives</h2>
        <button
          onClick={() => {
            setShowNew(true);
            setEditing(null);
          }}
          className="bg-burnt-orange text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-burnt-orange/90"
        >
          + Add New
        </button>
      </div>

      {/* Search/filter */}
      <div className="flex gap-4">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
          placeholder="Search objectives..."
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="hike">Hike</option>
          <option value="trail_run">Trail Run</option>
          <option value="alpine_climb">Alpine Climb</option>
          <option value="rock_climb">Rock Climb</option>
          <option value="mountaineering">Mountaineering</option>
          <option value="scramble">Scramble</option>
          <option value="backpacking">Backpacking</option>
        </select>
      </div>

      {/* Objectives list */}
      <div className="space-y-3">
        {filtered.map((obj) => (
          <div
            key={obj.id}
            className="bg-white rounded-lg shadow-sm border border-sage/20 p-4 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-forest">{obj.name}</span>
                <span className="text-xs bg-sage/10 text-sage px-2 py-0.5 rounded">{obj.type}</span>
                <span className="text-xs bg-sage/10 text-sage px-2 py-0.5 rounded">{obj.difficulty}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  obj.status === "active"
                    ? "bg-recovery-green/10 text-recovery-green"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {obj.status}
                </span>
              </div>
              <p className="text-sm text-sage mt-1">{obj.route}</p>
              <div className="flex gap-4 mt-1 text-xs text-sage">
                {obj.summit_elevation_ft && <span>Elev: {obj.summit_elevation_ft.toLocaleString()} ft</span>}
                {obj.distance_miles && <span>Dist: {obj.distance_miles} mi</span>}
                {obj.total_gain_ft && <span>Gain: {obj.total_gain_ft.toLocaleString()} ft</span>}
                {obj.recommended_weeks && <span>{obj.recommended_weeks} weeks</span>}
              </div>
            </div>
            <button
              onClick={() => {
                setEditing(obj);
                setShowNew(false);
              }}
              className="text-sm text-forest font-medium hover:underline"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {loading && <p className="text-sage text-center">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sage text-center py-8">No objectives found.</p>
      )}

      {/* Edit/New modal */}
      {(editing || showNew) && (
        <ObjectiveEditModal
          objective={editing}
          onClose={() => {
            setEditing(null);
            setShowNew(false);
          }}
          onSaved={() => {
            setEditing(null);
            setShowNew(false);
            fetchObjectives();
          }}
        />
      )}
    </div>
  );
}

function ObjectiveEditModal({
  objective,
  onClose,
  onSaved,
}: {
  objective: ValidatedObjective | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(objective?.name || "");
  const [route, setRoute] = useState(objective?.route || "");
  const [type, setType] = useState<ObjectiveType>(objective?.type || "hike");
  const [difficulty, setDifficulty] = useState<Difficulty>(objective?.difficulty || "intermediate");
  const [description, setDescription] = useState(objective?.description || "");
  const [elevation, setElevation] = useState(objective?.summit_elevation_ft?.toString() || "");
  const [gain, setGain] = useState(objective?.total_gain_ft?.toString() || "");
  const [distance, setDistance] = useState(objective?.distance_miles?.toString() || "");
  const [duration, setDuration] = useState(objective?.duration_days?.toString() || "");
  const [grade, setGrade] = useState(objective?.technical_grade || "");
  const [recommendedWeeks, setRecommendedWeeks] = useState(objective?.recommended_weeks?.toString() || "");
  const [aliases, setAliases] = useState((objective?.match_aliases || []).join(", "));
  const [status, setStatus] = useState(objective?.status || "active");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    const data = {
      name,
      route,
      type,
      difficulty,
      description: description || null,
      summit_elevation_ft: elevation ? parseInt(elevation) : null,
      total_gain_ft: gain ? parseInt(gain) : null,
      distance_miles: distance ? parseFloat(distance) : null,
      duration_days: duration ? parseInt(duration) : null,
      technical_grade: grade || null,
      recommended_weeks: recommendedWeeks ? parseInt(recommendedWeeks) : null,
      match_aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
      status,
    };

    if (objective) {
      await supabase.from("validated_objectives").update(data).eq("id", objective.id);
    } else {
      await supabase.from("validated_objectives").insert({
        ...data,
        tags: [],
        target_scores: { cardio: 50, strength: 50, climbing_technical: 25, flexibility: 30 },
        taglines: { cardio: "", strength: "", climbing_technical: "", flexibility: "" },
        relevance_profiles: {},
        graduation_benchmarks: { cardio: [], strength: [], climbing_technical: [], flexibility: [] },
      });
    }

    setLoading(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-forest">
              {objective ? "Edit Objective" : "New Validated Objective"}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
              <input value={route} onChange={(e) => setRoute(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as ObjectiveType)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest">
                <option value="hike">Hike</option>
                <option value="trail_run">Trail Run</option>
                <option value="alpine_climb">Alpine Climb</option>
                <option value="rock_climb">Rock Climb</option>
                <option value="mountaineering">Mountaineering</option>
                <option value="scramble">Scramble</option>
                <option value="backpacking">Backpacking</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Elevation (ft)</label>
              <input type="number" value={elevation} onChange={(e) => setElevation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Gain (ft)</label>
              <input type="number" value={gain} onChange={(e) => setGain(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles)</label>
              <input type="number" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Technical Grade</label>
              <input value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recommended Weeks</label>
              <input type="number" value={recommendedWeeks} onChange={(e) => setRecommendedWeeks(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Match Aliases (comma-separated)</label>
            <input value={aliases} onChange={(e) => setAliases(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest" placeholder="mont blanc, mont blanc normal route, ..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!name || !route || loading}
              className="flex-1 bg-forest text-white py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-forest/90"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
