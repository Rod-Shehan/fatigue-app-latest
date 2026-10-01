import type { Metadata } from "next";
import { ACTION_RECORD_PAGE_TITLE } from "@/lib/action-records-publish";

export const metadata: Metadata = {
  title: `${ACTION_RECORD_PAGE_TITLE} · Circadia Command`,
};

export default function RecordsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
