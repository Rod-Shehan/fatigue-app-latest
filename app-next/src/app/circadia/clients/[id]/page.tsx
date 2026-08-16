import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/auth";
import { CircadiaClientDetail } from "./circadia-client-detail";

export default async function CircadiaClientPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    redirect("/?branch=owner&callbackUrl=%2Fcircadia&error=circadia_required");
  }
  const { id } = await params;
  return <CircadiaClientDetail clientId={id} />;
}
