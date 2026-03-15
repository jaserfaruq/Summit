"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/auth/actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/assessment", label: "Assessment" },
  { href: "/plan", label: "Plan" },
  { href: "/log", label: "Log" },
  { href: "/progress", label: "Progress" },
];

export default function AppShell({
  children,
  email,
  isValidator,
}: {
  children: React.ReactNode;
  email: string;
  isValidator?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <header className="bg-dark-surface border-b border-dark-border px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-white text-xl font-bold">
            Summit Planner
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname.startsWith(item.href)
                    ? "bg-white/10 text-white"
                    : "text-dark-muted hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isValidator && (
              <Link
                href="/admin/objectives"
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-white/10 text-white"
                    : "text-dark-muted hover:text-white hover:bg-white/5"
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-dark-muted text-sm hidden sm:inline">{email}</span>
          <form action={signout}>
            <button
              type="submit"
              className="bg-gold/90 hover:bg-gold text-dark-bg text-sm font-medium py-1.5 px-3 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden bg-dark-surface border-b border-dark-border px-4 py-2 flex gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith(item.href)
                ? "bg-white/10 text-white"
                : "text-dark-muted hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="flex-1">{children}</main>
    </div>
  );
}
