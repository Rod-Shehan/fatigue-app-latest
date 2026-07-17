import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test desk",
};

export default function TestDeskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
