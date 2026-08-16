import type { Metadata } from "next";
import { CircadiaDeskShell } from "./circadia-desk-shell";
import {
  CIRCADIA_DESK_SHORT_NAME,
  CIRCADIA_DESK_TAGLINE,
  CIRCADIA_DESK_TITLE,
} from "@/lib/circadia-desk";

export const metadata: Metadata = {
  title: CIRCADIA_DESK_TITLE,
  applicationName: CIRCADIA_DESK_TITLE,
  description: CIRCADIA_DESK_TAGLINE,
  manifest: "/circadia/manifest.webmanifest",
  appleWebApp: {
    title: CIRCADIA_DESK_SHORT_NAME,
    capable: true,
    statusBarStyle: "default",
  },
};

export default function CircadiaDeskLayout({ children }: { children: React.ReactNode }) {
  return <CircadiaDeskShell>{children}</CircadiaDeskShell>;
}
