import Link from "next/link";
import LandingCTAs from "@/components/LandingCTAs";
import LandingNavBar from "@/components/landing/LandingNavBar";
import HeroSection from "@/components/landing/HeroSection";
import ScrollReveal from "@/components/landing/ScrollReveal";
import ObjectivesSection from "@/components/landing/ObjectivesSection";
import ScoringSection from "@/components/landing/ScoringSection";
import GraduationSection from "@/components/landing/GraduationSection";
import PlanChartsSection from "@/components/landing/PlanChartsSection";
import AdaptsSection from "@/components/landing/AdaptsSection";

/* ── How It Works ─────────────────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "Pick your objective.",
    body: "Choose from the validated library or describe a novel route. Summit anchors targets to the closest curated objective.",
  },
  {
    n: "02",
    title: "Get assessed.",
    body: "A two-layer AI assessment scores your current readiness across cardio, strength, climbing, and flexibility — with reasoning, not just a number.",
  },
  {
    n: "03",
    title: "Train. Log. Adapt.",
    body: "Weekly sessions are scaled-down graduation workouts. Rate each one 1 – 5. The plan rewrites itself toward what you actually need.",
  },
];

/* ── Page ─────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="relative overflow-x-hidden">
      <LandingNavBar />

      {/* 1. Hero */}
      <HeroSection>
        <LandingCTAs />
      </HeroSection>

      {/* 2. Validated Objectives */}
      <ScrollReveal as="div">
        <ObjectivesSection />
      </ScrollReveal>

      {/* 3. Four-Dimension Scoring */}
      <ScoringSection />

      {/* 4. Graduation Workouts */}
      <ScrollReveal as="div">
        <GraduationSection />
      </ScrollReveal>

      {/* 5. The Plan — charts */}
      <ScrollReveal as="div">
        <PlanChartsSection />
      </ScrollReveal>

      {/* 6. Adapts Weekly */}
      <AdaptsSection />

      {/* 7. How It Works */}
      <section className="relative py-20 md:py-28">
        <div className="absolute inset-0 -z-10 bg-dark-bg" />
        <div className="relative max-w-7xl mx-auto px-8 md:px-14">
          <ScrollReveal>
            <p className="text-burnt-orange text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
              HOW IT WORKS
            </p>
            <h2 className="font-display font-bold text-white text-3xl md:text-4xl tracking-tight leading-[1.1] mb-10">
              Three steps. Then the work.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <ScrollReveal key={s.n} delay={i * 80}>
                <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-xl p-7 h-full">
                  <div className="font-display font-bold text-[56px] text-burnt-orange leading-none tabular-nums mb-6 tracking-tight">
                    {s.n}
                  </div>
                  <h3 className="font-display font-bold text-[26px] text-white tracking-tight leading-[1.1] mb-3">
                    {s.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-white/70">
                    {s.body}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Final CTA */}
      <section className="relative py-32 md:py-40 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[#141c18]" />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 120% 80% at 60% 20%, rgba(27,77,62,0.35) 0%, transparent 60%), radial-gradient(ellipse 80% 40% at 70% 30%, rgba(80,60,30,0.15) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to bottom, rgba(14,18,16,0.95), rgba(14,18,16,0.55) 40%, rgba(14,18,16,0.95))",
          }}
        />

        <div className="max-w-3xl mx-auto text-center px-8">
          <ScrollReveal>
            <div className="inline-flex mb-7">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                className="text-burnt-orange"
              >
                <path
                  d="M12 2L2 20h20L12 2z"
                  fill="currentColor"
                  opacity="0.9"
                />
                <path
                  d="M12 8l-5 10h10L12 8z"
                  fill="#1B4D3E"
                  opacity="0.6"
                />
              </svg>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h2
              className="font-display font-bold text-white leading-[0.95] tracking-tight mb-5"
              style={{ fontSize: "clamp(48px, 7vw, 88px)" }}
            >
              Pick a mountain.
              <br />
              Train for it.
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={180}>
            <p className="text-white/70 text-[17px] leading-relaxed mb-10 max-w-xl mx-auto">
              Your first plan is free. No credit card. The mountain
              doesn&apos;t care either way — but it&apos;d rather you arrive
              ready.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={260}>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href="/signup"
                className="btn-press bg-burnt-orange hover:bg-burnt-orange/90 text-dark-bg font-semibold py-3.5 px-8 rounded-lg transition-colors text-[15px]"
              >
                Plan your summit
              </Link>
              <Link
                href="/signup"
                className="btn-press border border-white/20 text-white/85 hover:text-white hover:border-white/40 font-semibold py-3.5 px-8 rounded-lg transition-colors text-[15px]"
              >
                Create an account
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-[rgba(14,18,16,0.95)] border-t border-dark-border/50 px-8 md:px-14 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className="text-burnt-orange"
            >
              <path
                d="M12 2L2 20h20L12 2z"
                fill="currentColor"
                opacity="0.9"
              />
              <path
                d="M12 8l-5 10h10L12 8z"
                fill="#1B4D3E"
                opacity="0.6"
              />
            </svg>
            <span className="font-display font-bold text-base text-white uppercase tracking-tight">
              SUMMIT
            </span>
          </div>

          <div className="flex gap-6 text-xs text-white/55">
            <a href="#objectives" className="hover:text-white transition-colors">
              Objectives
            </a>
            <Link href="/login" className="hover:text-white transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-white transition-colors">
              Sign up
            </Link>
          </div>

          <div className="text-[11px] text-white/40">
            © 2026 Summit Planner. Built for the mountain.
          </div>
        </div>
      </footer>
    </div>
  );
}
