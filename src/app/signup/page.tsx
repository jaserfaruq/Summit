"use client";

import { signup } from "@/app/auth/actions";
import Link from "next/link";
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
        <img src="/IMG_0232.jpeg" alt="" className="w-full h-full object-cover blur-[1px] scale-105" />
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <header className="bg-dark-surface/80 backdrop-blur-md border-b border-dark-border/50 px-6 py-4">
        <h1 className="text-white text-xl font-bold">Summit Planner</h1>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
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
              <label htmlFor="email" className="block text-sm font-medium text-dark-muted mb-1">
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
              <label htmlFor="password" className="block text-sm font-medium text-dark-muted mb-1">
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

          <p className="mt-6 text-center text-sm text-dark-muted">
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
