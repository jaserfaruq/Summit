import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the user's active plan to get the current week number
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, current_week_number")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!plan) {
    return NextResponse.json({ notifications: [] });
  }

  // Fetch unread/undismissed notifications for the current week
  const { data: notifications, error } = await supabase
    .from("partner_notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("plan_id", plan.id)
    .eq("week_number", plan.current_week_number)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }

  return NextResponse.json({
    notifications: (notifications || []).map((n) => ({
      id: n.id,
      partnerName: n.partner_name,
      matchType: n.match_type,
      matchSummary: n.match_summary,
      weekNumber: n.week_number,
      isRead: n.is_read,
      matchedSessions: n.matched_sessions,
    })),
  });
}
