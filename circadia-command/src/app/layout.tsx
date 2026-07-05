import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circadia Command",
  description: "Circadia operator triage console — live fatigue incident monitoring.",
  applicationName: "Circadia Command",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Command",
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
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
