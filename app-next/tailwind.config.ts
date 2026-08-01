import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        ck: {
          midnight: "rgb(var(--ck-midnight) / <alpha-value>)",
          slate: "rgb(var(--ck-slate) / <alpha-value>)",
          cobalt: "rgb(var(--ck-cobalt) / <alpha-value>)",
          "cobalt-alt": "rgb(var(--ck-cobalt-alt) / <alpha-value>)",
          emerald: "rgb(var(--ck-emerald) / <alpha-value>)",
          red: "rgb(var(--ck-red) / <alpha-value>)",
          steel: "rgb(var(--ck-steel) / <alpha-value>)",
          border: "rgb(var(--ck-border) / <alpha-value>)",
          fg: "rgb(var(--ck-fg) / <alpha-value>)",
          "fg-muted": "rgb(var(--ck-fg-muted) / <alpha-value>)",
          "on-accent": "rgb(var(--ck-on-accent) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
