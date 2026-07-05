import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        border: "hsl(var(--border))",
        command: {
          bg: "#020617",
          panel: "#0f172a",
          border: "#334155",
          accent: "#0f766e",
          safe: "#22c55e",
          danger: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
