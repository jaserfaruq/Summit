import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "arc-in": {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "gold-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gentle-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        "report-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212, 120, 47, 0)" },
          "50%": { boxShadow: "0 0 8px 2px rgba(212, 120, 47, 0.3)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s cubic-bezier(0.25, 1, 0.5, 1) both",
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.25, 1, 0.5, 1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.25, 1, 0.5, 1) both",
        "arc-in": "arc-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) both",
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.25, 1, 0.5, 1) both",
        "slide-out-right": "slide-out-right 0.2s cubic-bezier(0.25, 1, 0.5, 1) both",
        "gold-shimmer": "gold-shimmer 2s ease-in-out 0.5s 1",
        "gentle-pulse": "gentle-pulse 3s ease-in-out 2",
        "report-glow": "report-glow 1.5s ease-in-out 2",
      },
      colors: {
        "forest": "#1B4D3E",
        "burnt-orange": "#D4782F",
        "off-white": "#F4F1EC",
        "sage": "#8B9D83",
        "test-blue": "#1A5276",
        "hiking-green": "#2E7D32",
        "taper-amber": "#F57F17",
        // Dark theme colors
        "dark-bg": "#0e1210",
        "dark-surface": "#171d1a",
        "dark-card": "#1e2820",
        "dark-border": "#2d3b33",
        "dark-text": "#e8ece9",
        "dark-muted": "#7a8f82",
        // Primary action color (burnt orange — replaces gold for CTAs)
        "gold": "#D4782F",
        // Semantic medal color for Gold-tier badges only
        "medal-gold": "#D4A017",
      },
    },
  },
  plugins: [],
};
export default config;
