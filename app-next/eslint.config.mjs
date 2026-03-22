import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Next.js 16 / React Compiler rules: many valid patterns (sessionStorage, theme, timers) still trip these.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      // Intentional omissions are common with TanStack Query / stable callbacks.
      "react-hooks/exhaustive-deps": "off",
      // Base64 / dynamic images in fatigue UI; Next/Image is not always applicable.
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      ".firebase/**",
      "coverage/**",
      "prisma/migrations/**",
      "prisma/**/*.js",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
