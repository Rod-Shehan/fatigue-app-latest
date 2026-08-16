import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/auth";
import { CIRCADIA_DESK_PATH } from "@/lib/circadia-desk";
import { CircadiaClientDetail } from "./circadia-client-detail";

export default async function CircadiaClientPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    redirect(CIRCADIA_DESK_PATH);
  }
  const { id } = await params;
  return <CircadiaClientDetail clientId={id} />;
}
