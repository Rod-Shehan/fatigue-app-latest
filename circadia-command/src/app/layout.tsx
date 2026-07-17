import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { PRODUCT_NAME, PRODUCT_NAME_SHORT, PRODUCT_TAGLINE } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`,
  applicationName: PRODUCT_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: PRODUCT_NAME_SHORT,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/command-icon-192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/command-icon-512.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

const themeScript = `
(function() {
  var key = 'circadia-theme';
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
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
