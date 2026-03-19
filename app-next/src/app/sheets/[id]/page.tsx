import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { SheetDetail } from "./sheet-detail";

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { id } = await params;
  const managerSession = await getManagerSession();
  return <SheetDetail sheetId={id} canAccessManager={!!managerSession} />;
}
