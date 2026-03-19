import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import ShiftLogPage from "./shift-log-page";

export default async function ShiftLogRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  await getManagerSession();
  const { id } = await params;
  return <ShiftLogPage sheetId={id} />;
}
