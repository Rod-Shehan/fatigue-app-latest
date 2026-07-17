import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Triage",
};

export default function TriageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
