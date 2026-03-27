"use client";

import { signup } from "@/app/auth/actions";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signup(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Fixed blurred background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/IMG_0232.jpeg" alt="" fill className="object-cover scale-105" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black/75" />
      </div>
      <header className="bg-dark-surface/80 backdrop-blur-md border-b border-dark-border/50 px-4 md:px-6 h-14 flex items-center">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-burnt-orange shrink-0">
            <path d="M12 2L2 20h20L12 2z" fill="currentColor" opacity="0.9" />
            <path d="M12 8l-5 10h10L12 8z" fill="#1B4D3E" opacity="0.6" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight text-white uppercase">Summit</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-dark-bg/85 backdrop-blur-md rounded-2xl p-8 border border-dark-border/50">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Sign Up
          </h2>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded mb-6 text-sm">
              {error}
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-text/70 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark-text/70 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                className="w-full px-4 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold hover:bg-gold/90 text-dark-bg font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-dark-text/60">
            Already have an account?{" "}
            <Link href="/login" className="text-gold hover:underline font-medium">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
