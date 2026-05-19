import Image from "next/image";

export default function HeroSection({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-screen flex flex-col justify-end relative overflow-hidden">
      {/* Background image */}
      <Image
        src="/IMG_0232.jpeg"
        alt=""
        fill
        priority
        className="object-cover scale-105"
        sizes="100vw"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-black/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10 px-8 md:px-14 pb-16 md:pb-24">
        <div className="max-w-[620px]">
          <h1
            className="font-display font-bold text-white leading-[0.92] tracking-tight mb-7 animate-fade-in-up"
            style={{
              fontSize: "clamp(64px, 8.5vw, 112px)",
              animationDelay: "80ms",
              animationFillMode: "both",
            }}
          >
            Train for
            <br />
            the summit.
          </h1>

          <p
            className="text-white/70 text-[17px] leading-relaxed mb-10 max-w-[440px] animate-fade-in-up"
            style={{ animationDelay: "160ms", animationFillMode: "both" }}
          >
            AI-generated plans calibrated to your specific objective —
            Half&nbsp;Dome, Mont&nbsp;Blanc, Denali. Scored across cardio,
            strength, climbing, and flexibility. Adapts weekly.
          </p>

          <div
            className="flex flex-wrap gap-3 animate-fade-in-up"
            style={{ animationDelay: "240ms", animationFillMode: "both" }}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 text-[11px] uppercase tracking-[0.3em] font-semibold animate-gentle-pulse">
        <span>Scroll</span>
        <svg
          width="12"
          height="20"
          viewBox="0 0 12 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2v14M2 12l4 4 4-4" />
        </svg>
      </div>
    </section>
  );
}
