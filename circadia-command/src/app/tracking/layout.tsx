import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event Tracker · Circadia Command",
};

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
