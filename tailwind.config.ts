import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "forest": "#1B4D3E",
        "burnt-orange": "#D4782F",
        "off-white": "#F4F1EC",
        "sage": "#8B9D83",
        "test-blue": "#1A5276",
        "recovery-green": "#2E7D32",
        "taper-amber": "#F57F17",
      },
    },
  },
  plugins: [],
};
export default config;
