import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
        "dark-bg": "#111111",
        "dark-surface": "#1a1a1a",
        "dark-card": "#222222",
        "dark-border": "#333333",
        "dark-text": "#e5e5e5",
        "dark-muted": "#888888",
        "gold": "#D4A017",
      },
    },
  },
  plugins: [],
};
export default config;
