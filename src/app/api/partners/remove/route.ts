import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { partnershipId } = await request.json();
  if (!partnershipId) {
    return NextResponse.json({ error: "Partnership ID is required" }, { status: 400 });
  }

  // Verify the user is part of this partnership
  const { data: partnership, error: fetchError } = await supabase
    .from("partnerships")
    .select("*")
    .eq("id", partnershipId)
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .single();

  if (fetchError || !partnership) {
    return NextResponse.json({ error: "Partnership not found" }, { status: 404 });
  }

  // Delete related notifications
  await supabase
    .from("partner_notifications")
    .delete()
    .eq("partnership_id", partnershipId);

  // Delete the partnership
  const { error: deleteError } = await supabase
    .from("partnerships")
    .delete()
    .eq("id", partnershipId);

  if (deleteError) {
    console.error("Error deleting partnership:", deleteError);
    return NextResponse.json({ error: "Failed to remove partner" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
