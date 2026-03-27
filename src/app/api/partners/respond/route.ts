import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { partnershipId, action } = await request.json();
  if (!partnershipId || !["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Verify the user is the recipient of this partnership
  const { data: partnership, error: fetchError } = await supabase
    .from("partnerships")
    .select("*")
    .eq("id", partnershipId)
    .eq("recipient_id", user.id)
    .eq("status", "pending")
    .single();

  if (fetchError || !partnership) {
    return NextResponse.json({ error: "Partnership request not found" }, { status: 404 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";

  const { data: updated, error: updateError } = await supabase
    .from("partnerships")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", partnershipId)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating partnership:", updateError);
    return NextResponse.json({ error: "Failed to update partnership" }, { status: 500 });
  }

  return NextResponse.json({ partnership: updated });
}
