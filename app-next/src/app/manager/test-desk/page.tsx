import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/auth";
import { TestDeskPanel } from "@/components/manager/TestDeskPanel";
import { MaintenanceContactSettingsPanel } from "@/components/manager/MaintenanceContactSettingsPanel";

export const metadata = {
  title: "Test desk · Circadia Manager",
};

export default async function ManagerTestDeskPage() {
  const session = await getManagerSession();
  if (!session) redirect("/login?callbackUrl=/manager/test-desk");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <MaintenanceContactSettingsPanel title="WAHVA maintenance contact" />
      <TestDeskPanel backHref="/manager/alerts" backLabel="Live alerts" />
    </div>
  );
}
