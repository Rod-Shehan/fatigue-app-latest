import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/auth";
import { TestDeskPanel } from "@/components/manager/TestDeskPanel";
import { MANAGER_PAGE_SHELL } from "@/lib/manager-experience";

export const metadata = {
  title: "Test desk · Circadia Manager",
};

export default async function ManagerTestDeskPage() {
  const session = await getManagerSession();
  if (!session) redirect("/login?callbackUrl=/manager/test-desk");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className={`${MANAGER_PAGE_SHELL} space-y-8`}>
        <TestDeskPanel backHref="/manager/alerts" backLabel="Live alerts" />
      </div>
    </div>
  );
}
