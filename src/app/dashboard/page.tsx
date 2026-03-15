import { createClient } from "@/lib/supabase-server";
import { signout } from "@/app/auth/actions";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="bg-forest px-6 py-4 flex items-center justify-between">
        <h1 className="text-white text-xl font-bold">Summit Planner</h1>
        <form action={signout}>
          <button
            type="submit"
            className="bg-burnt-orange hover:bg-burnt-orange/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </form>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-forest mb-4">
            Welcome to Summit Planner.
          </h2>
          <p className="text-gray-600">
            Logged in as {user.email}
          </p>
        </div>
      </main>
    </div>
  );
}
