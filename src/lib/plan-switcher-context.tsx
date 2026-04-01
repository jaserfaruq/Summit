"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase";

export interface PlanSummary {
  id: string;
  objective_name: string;
  objective_type: string;
  target_date: string;
  created_at: string;
  current_week_number: number;
}

interface PlanSwitcherContextValue {
  activePlanId: string | null;
  plans: PlanSummary[];
  setActivePlanId: (id: string) => void;
  refreshPlans: () => Promise<void>;
  isLoading: boolean;
}

const STORAGE_KEY = "summit-active-plan-id";

const PlanSwitcherContext = createContext<PlanSwitcherContextValue>({
  activePlanId: null,
  plans: [],
  setActivePlanId: () => {},
  refreshPlans: async () => {},
  isLoading: true,
});

export function usePlanSwitcher() {
  return useContext(PlanSwitcherContext);
}

export function PlanSwitcherProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [activePlanId, setActivePlanIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPlans([]);
      setActivePlanIdState(null);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("training_plans")
      .select("id, created_at, current_week_number, objectives(name, type, target_date)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      setPlans([]);
      setActivePlanIdState(null);
      setIsLoading(false);
      return;
    }

    const mapped: PlanSummary[] = data.map((p: Record<string, unknown>) => {
      const obj = p.objectives as Record<string, unknown> | null;
      return {
        id: p.id as string,
        objective_name: (obj?.name as string) || "Unnamed Objective",
        objective_type: (obj?.type as string) || "hike",
        target_date: (obj?.target_date as string) || "",
        created_at: p.created_at as string,
        current_week_number: p.current_week_number as number,
      };
    });

    setPlans(mapped);

    // Validate saved selection
    const saved = localStorage.getItem(STORAGE_KEY);
    const validIds = new Set(mapped.map((p) => p.id));

    if (saved && validIds.has(saved)) {
      setActivePlanIdState(saved);
    } else {
      // Default to most recent plan
      const defaultId = mapped[0].id;
      setActivePlanIdState(defaultId);
      localStorage.setItem(STORAGE_KEY, defaultId);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const setActivePlanId = useCallback((id: string) => {
    setActivePlanIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refreshPlans = useCallback(async () => {
    await fetchPlans();
  }, [fetchPlans]);

  return (
    <PlanSwitcherContext.Provider value={{ activePlanId, plans, setActivePlanId, refreshPlans, isLoading }}>
      {children}
    </PlanSwitcherContext.Provider>
  );
}
