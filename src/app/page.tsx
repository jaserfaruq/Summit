import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background — gradient lets mountain show at top, darkens at bottom for text readability */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/IMG_0232.jpeg"
          alt=""
          fill
          className="object-cover scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
      </div>

      {/* Header */}
      <header className="px-8 md:px-14 py-6 flex items-center justify-between">
        <span className="font-display text-white font-bold text-xl tracking-tight">
          Summit
        </span>
        <Link
          href="/login"
          className="text-sm text-white/60 hover:text-white transition-colors font-medium"
        >
          Log In
        </Link>
      </header>

      {/* Main — anchored to bottom-left, mountain dominates the upper frame */}
      <main className="flex-1 flex flex-col justify-end px-8 md:px-14 pb-14 md:pb-20">
        <div className="max-w-lg">
          <p className="text-burnt-orange text-[11px] font-bold uppercase tracking-[0.3em] mb-5">
            Mountain Athletics Training
          </p>

          <h1 className="font-display text-[3.25rem] md:text-[5rem] font-bold text-white leading-[0.95] tracking-tight mb-6">
            Train for<br />the summit.
          </h1>

          <p className="text-white/60 text-base leading-relaxed mb-10 max-w-sm">
            AI-generated plans calibrated to your specific objective —
            Half Dome, Mont Blanc, Denali. Scored across cardio, strength,
            climbing, and flexibility. Adapts weekly.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="bg-burnt-orange hover:bg-burnt-orange/90 text-white font-semibold py-3 px-7 rounded-lg transition-colors text-sm"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="border border-white/20 text-white/80 hover:text-white hover:border-white/40 font-semibold py-3 px-7 rounded-lg transition-colors text-sm"
            >
              Log In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
