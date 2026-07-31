import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/auth";
import { ChecklistKitDemo } from "@/components/checklist/ChecklistKitDemo";

export const metadata = {
  title: "Checklist kit · Circadia Manager",
};

export default async function ManagerChecklistKitPage() {
  const session = await getManagerSession();
  if (!session) redirect("/login?callbackUrl=/manager/checklist-kit");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ChecklistKitDemo backHref="/manager/test-desk" />
    </div>
  );
}
