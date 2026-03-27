"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { signout } from "@/app/auth/actions";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="6" height="7" rx="1" />
        <rect x="11" y="3" width="6" height="4" rx="1" />
        <rect x="3" y="12" width="6" height="5" rx="1" />
        <rect x="11" y="9" width="6" height="8" rx="1" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h12M4 8h8M4 12h10M4 16h6" />
      </svg>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3,16 7,10 11,13 17,4" />
        <polyline points="14,4 17,4 17,7" />
      </svg>
    ),
  },
  {
    href: "/partners",
    label: "Partners",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="3" />
        <circle cx="14" cy="8" r="2.5" />
        <path d="M2 17c0-3 2.5-5 5-5s5 2 5 5" />
        <path d="M13 17c0-2.5 1.5-4 3.5-4s3.5 1.5 3.5 4" />
      </svg>
    ),
  },
];

const ADMIN_ITEM = {
  href: "/admin/objectives",
  label: "Admin",
  icon: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4" />
    </svg>
  ),
};

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const initial = email ? email[0].toUpperCase() : "?";

  const allNavItems = isValidator
    ? [...NAV_ITEMS, ADMIN_ITEM]
    : NAV_ITEMS;

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Fixed blurred background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/IMG_0232.jpeg" alt="" fill className="object-cover scale-105" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/70" />
      </div>

      {/* Desktop header */}
      <header className="bg-dark-surface/80 backdrop-blur-md border-b border-dark-border/50 px-4 md:px-6 h-14 flex items-center justify-between">
        {/* Left: brand */}
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-burnt-orange shrink-0">
            <path d="M12 2L2 20h20L12 2z" fill="currentColor" opacity="0.9" />
            <path d="M12 8l-5 10h10L12 8z" fill="#1B4D3E" opacity="0.6" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight text-white uppercase">
            Summit
          </span>
        </Link>

        {/* Center: desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {allNavItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "text-white"
                    : "text-dark-muted hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-burnt-orange rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: avatar menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full bg-forest/80 text-white text-sm font-semibold flex items-center justify-center hover:bg-forest transition-colors"
            aria-label="Account menu"
          >
            {initial}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden animate-scale-in origin-top-right z-50">
              <div className="px-4 py-3 border-b border-dark-border/50">
                <p className="text-sm text-dark-text truncate">{email}</p>
              </div>
              <form action={signout}>
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2.5 text-sm text-dark-muted hover:text-white hover:bg-white/5 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Main content — add bottom padding on mobile for tab bar */}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-dark-surface/95 backdrop-blur-md border-t border-dark-border/50 z-40">
        <div className="flex items-stretch justify-around h-16 px-1">
          {allNavItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors relative ${
                  active ? "text-burnt-orange" : "text-dark-muted"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-burnt-orange rounded-b-full" />
                )}
                <span className={active ? "text-burnt-orange" : "text-dark-muted"}>
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium tracking-wide">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area for iOS home indicator */}
        <div className="h-safe-bottom bg-dark-surface/95" />
      </nav>
    </div>
  );
}
