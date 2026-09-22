import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/auth";
import { ChecklistKitDemo } from "@/components/checklist/ChecklistKitDemo";
import { MANAGER_PAGE_SHELL } from "@/lib/manager-experience";

export const metadata = {
  title: "Checklist kit · Circadia Manager",
};

export default async function ManagerChecklistKitPage() {
  const session = await getManagerSession();
  if (!session) redirect("/login?callbackUrl=/manager/checklist-kit");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className={MANAGER_PAGE_SHELL}>
        <ChecklistKitDemo backHref="/manager/test-desk" />
      </div>
    </div>
  );
}
