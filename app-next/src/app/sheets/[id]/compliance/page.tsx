import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import SheetCompliancePage from "./sheet-compliance-page";

export default async function SheetComplianceRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  await getManagerSession();
  const { id } = await params;
  return <SheetCompliancePage sheetId={id} />;
}
