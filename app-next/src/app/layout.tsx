import type { Metadata } from "next";
import "./globals.css";
import { PRODUCT_NAME, TAGLINE_VEHICLE } from "@/lib/branding";
import { Providers } from "@/components/providers";
import { ThemeToggleInLayout } from "@/components/theme-toggle-in-layout";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} – WA`,
  description: `${PRODUCT_NAME} — ${TAGLINE_VEHICLE}`,
};

const themeScript = `
(function() {
  var key = 'fatigue-theme';
  var stored = localStorage.getItem(key);
  var system = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = stored === 'dark' || (stored !== 'light' && system);
  if (dark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="theme-color" content="#0f172a" />
        <meta name="application-name" content={PRODUCT_NAME} />
        <meta name="apple-mobile-web-app-title" content={PRODUCT_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-512.svg" />
      </head>
      <body>
        <Providers>
          <ThemeToggleInLayout />
          {children}
        </Providers>
      </body>
    </html>
  );
}
