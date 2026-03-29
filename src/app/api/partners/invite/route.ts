import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientEmail } = await request.json();
    if (!recipientEmail || typeof recipientEmail !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Prevent self-invite
    if (recipientEmail.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
    }

    // Use service role to look up user by email in auth.users
    const serviceClient = createServiceClient();
    const { data: { users }, error: lookupError } = await serviceClient.auth.admin.listUsers();

    if (lookupError) {
      console.error("Error looking up users:", lookupError);
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 });
    }

    const recipient = users.find(
      (u) => u.email?.toLowerCase() === recipientEmail.toLowerCase()
    );

    if (!recipient) {
      return NextResponse.json(
        { error: "No Summit Planner account found for that email." },
        { status: 404 }
      );
    }

    // Check for existing partnership in either direction
    const { data: existing } = await supabase
      .from("partnerships")
      .select("id, status")
      .or(
        `and(requester_id.eq.${user.id},recipient_id.eq.${recipient.id}),and(requester_id.eq.${recipient.id},recipient_id.eq.${user.id})`
      );

    if (existing && existing.length > 0) {
      const partnership = existing[0];
      if (partnership.status === "accepted") {
        return NextResponse.json({ error: "You are already partners." }, { status: 400 });
      }
      if (partnership.status === "pending") {
        return NextResponse.json({ error: "A partnership request is already pending." }, { status: 400 });
      }
    }

    // Fetch recipient's profile name
    const { data: recipientProfile } = await serviceClient
      .from("profiles")
      .select("name")
      .eq("id", recipient.id)
      .single();

    // Create the partnership
    const { data: partnership, error: insertError } = await supabase
      .from("partnerships")
      .insert({
        requester_id: user.id,
        recipient_id: recipient.id,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating partnership:", insertError);
      return NextResponse.json({ error: "Failed to create partnership request" }, { status: 500 });
    }

    return NextResponse.json({
      partnershipId: partnership.id,
      recipientName: recipientProfile?.name || recipientEmail,
      status: "pending",
    });
  } catch (err) {
    console.error("Partner invite error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
