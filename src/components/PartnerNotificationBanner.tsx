"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface NotificationData {
  id: string;
  partnerName: string;
  matchSummary: string;
  matchType: string;
  isRead: boolean;
}

export default function PartnerNotificationBanner() {
  const [notification, setNotification] = useState<NotificationData | null>(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch("/api/partners/notifications");
        if (!res.ok) return;
        const data = await res.json();
        if (data.notifications && data.notifications.length > 0) {
          setNotification(data.notifications[0]);
        }
      } catch {
        // Silent fail — notifications are non-critical
      }
    }

    fetchNotifications();
  }, []);

  async function handleDismiss() {
    if (!notification) return;
    setNotification(null);

    try {
      await fetch("/api/partners/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id }),
      });
    } catch {
      // Silent fail
    }
  }

  if (!notification) return null;

  return (
    <div className="bg-sage/10 border border-sage/20 rounded-xl p-4 flex items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <svg className="w-5 h-5 text-sage flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm text-white truncate">
          {notification.matchSummary} — want to sync up?
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/partners"
          className="text-xs font-medium text-burnt-orange hover:text-burnt-orange/80 transition-colors"
        >
          View
        </Link>
        <button
          onClick={handleDismiss}
          className="text-dark-muted hover:text-white p-1 transition-colors"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
