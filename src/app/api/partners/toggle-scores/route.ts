import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { partnershipId, shareScores } = await request.json();
  if (!partnershipId || typeof shareScores !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fetch the partnership to determine which flag to update
  const { data: partnership, error: fetchError } = await supabase
    .from("partnerships")
    .select("*")
    .eq("id", partnershipId)
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .single();

  if (fetchError || !partnership) {
    return NextResponse.json({ error: "Partnership not found" }, { status: 404 });
  }

  if (partnership.status !== "accepted") {
    return NextResponse.json({ error: "Partnership must be accepted to toggle scores" }, { status: 400 });
  }

  // Update the appropriate flag based on which user is calling
  const updateField = partnership.requester_id === user.id
    ? { requester_shares_scores: shareScores }
    : { recipient_shares_scores: shareScores };

  const { data: updated, error: updateError } = await supabase
    .from("partnerships")
    .update({ ...updateField, updated_at: new Date().toISOString() })
    .eq("id", partnershipId)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating score sharing:", updateError);
    return NextResponse.json({ error: "Failed to update score sharing" }, { status: 500 });
  }

  return NextResponse.json({ partnership: updated });
}
