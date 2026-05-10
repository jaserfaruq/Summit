"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

function safeReturn(value: string | null): string | null {
  // Whitelist allowed return targets to prevent open-redirect abuse
  if (value === "persist") return "persist";
  return null;
}

export async function login(formData: FormData) {
  const supabase = createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return { error: error.message };
  }

  const ret = safeReturn(formData.get("return") as string | null);
  if (ret === "persist") {
    redirect("/draft-import");
  }
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    return { error: error.message };
  }

  const ret = safeReturn(formData.get("return") as string | null);
  const returnParam = ret === "persist" ? "&return=persist" : "";
  redirect("/login?message=Check your email to confirm your account" + returnParam);
}

export async function signout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
