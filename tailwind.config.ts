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
      },
      animation: {
        "slide-up": "slide-up 0.2s ease-out",
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
