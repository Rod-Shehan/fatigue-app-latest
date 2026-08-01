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
          midnight: "var(--ck-midnight, #F8FAFC)",
          slate: "var(--ck-slate, #F1F5F9)",
          cobalt: "var(--ck-cobalt, #007AFF)",
          "cobalt-alt": "var(--ck-cobalt-alt, #1E88E5)",
          emerald: "var(--ck-emerald, #10B981)",
          red: "var(--ck-red, #EF4444)",
          steel: "var(--ck-steel, #64748B)",
          border: "var(--ck-border, #CBD5E1)",
          fg: "var(--ck-fg, #0F172A)",
          "fg-muted": "var(--ck-fg-muted, #475569)",
          "on-accent": "var(--ck-on-accent, #FFFFFF)",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
