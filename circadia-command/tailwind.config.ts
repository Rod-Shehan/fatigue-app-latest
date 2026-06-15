import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        command: {
          bg: "#0a0e14",
          panel: "#121820",
          border: "#1e2836",
          amber: "#f59e0b",
          safe: "#22c55e",
          danger: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
