import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notificationId } = await request.json();
  if (!notificationId) {
    return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("partner_notifications")
    .update({ is_dismissed: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error dismissing notification:", error);
    return NextResponse.json({ error: "Failed to dismiss notification" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
