import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import {
  documentDescriptionForSurface,
  documentTitleForSurface,
  getAppSurface,
} from "@/lib/app-surface";
import { Providers } from "@/components/providers";
import { ThemeToggleInLayout } from "@/components/theme-toggle-in-layout";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const surface = getAppSurface(host);
  const title = documentTitleForSurface(surface);
  return {
    title,
    description: documentDescriptionForSurface(surface),
    applicationName: title,
    appleWebApp: {
      title,
      capable: true,
      statusBarStyle: "black-translucent",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const surface = getAppSurface(host);
  const appName = documentTitleForSurface(surface);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="application-name" content={appName} />
        <meta name="apple-mobile-web-app-title" content={appName} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
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
