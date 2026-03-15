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
      },
    },
  },
  plugins: [],
};
export default config;
