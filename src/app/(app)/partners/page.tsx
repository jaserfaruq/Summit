"use client";

import { useState, useEffect, useCallback } from "react";
import { PartnerListResponse, PartnerWeekResponse } from "@/lib/types";
import PartnerList from "@/components/PartnerList";
import PartnerWeekView from "@/components/PartnerWeekView";

export default function PartnersPage() {
  const [data, setData] = useState<PartnerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partnerWeek, setPartnerWeek] = useState<PartnerWeekResponse | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/partners/list");
      if (!res.ok) throw new Error("Failed to fetch partners");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching partners:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // Fetch partner week data when a partner is selected
  useEffect(() => {
    if (!selectedPartnerId) {
      setPartnerWeek(null);
      return;
    }

    async function fetchWeek() {
      setWeekLoading(true);
      try {
        const res = await fetch(`/api/partners/week/${selectedPartnerId}`);
        if (!res.ok) throw new Error("Failed to fetch partner week");
        const json = await res.json();
        setPartnerWeek(json);
      } catch (err) {
        console.error("Error fetching partner week:", err);
        setPartnerWeek(null);
      } finally {
        setWeekLoading(false);
      }
    }

    fetchWeek();
  }, [selectedPartnerId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-card/50 rounded w-48" />
          <div className="h-32 bg-dark-card/50 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="font-display text-2xl font-bold text-white">Training Partners</h1>

      <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-2xl p-6">
        <PartnerList
          accepted={data?.accepted || []}
          pending={data?.pending || []}
          selectedPartnerId={selectedPartnerId}
          onSelectPartner={setSelectedPartnerId}
          onRefresh={fetchPartners}
        />
      </div>

      {/* Side-by-side week view */}
      {selectedPartnerId && (
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-2xl p-6">
          {weekLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-dark-surface rounded w-64" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-48 bg-dark-surface rounded" />
                <div className="h-48 bg-dark-surface rounded" />
              </div>
            </div>
          ) : partnerWeek ? (
            <PartnerWeekView
              partnerWeek={partnerWeek}
              onRefresh={fetchPartners}
            />
          ) : (
            <p className="text-dark-muted text-sm text-center py-8">
              Could not load partner&apos;s week data.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
