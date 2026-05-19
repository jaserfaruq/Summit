"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { id: "objectives", label: "Objectives" },
  { id: "scoring", label: "Scoring" },
  { id: "plan", label: "The plan" },
  { id: "adapts", label: "How it adapts" },
] as const;

export default function LandingNavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-8 py-3.5 flex items-center justify-between transition-all duration-300 ${
        scrolled
          ? "bg-dark-surface/80 backdrop-blur-md border-b border-dark-border/50"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          className="text-burnt-orange shrink-0"
        >
          <path d="M12 2L2 20h20L12 2z" fill="currentColor" opacity="0.9" />
          <path d="M12 8l-5 10h10L12 8z" fill="#1B4D3E" opacity="0.6" />
        </svg>
        <span className="font-display text-xl font-bold tracking-tight text-white uppercase">
          SUMMIT
        </span>
      </Link>

      {/* Center nav links */}
      <nav className="hidden md:flex items-center gap-7">
        {NAV_ITEMS.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById(id)
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-[13px] text-white/70 font-medium hover:text-white transition-colors cursor-pointer"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Auth links */}
      <div className="flex items-center gap-3.5">
        <Link
          href="/login"
          className="text-[13px] text-white/65 font-medium hover:text-white transition-colors hidden sm:block"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="btn-press bg-burnt-orange hover:bg-burnt-orange/90 text-dark-bg font-semibold text-[13px] py-1.5 px-4 rounded-lg transition-colors"
        >
          Plan your summit
        </Link>
      </div>
    </header>
  );
}
