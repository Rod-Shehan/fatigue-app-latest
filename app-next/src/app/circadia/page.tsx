import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/auth";
import { CircadiaClientsView } from "./circadia-clients-view";

export default async function CircadiaClientsPage() {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    redirect("/?branch=owner&callbackUrl=%2Fcircadia&error=circadia_required");
  }
  return <CircadiaClientsView staffEmail={staff.user.email ?? ""} />;
}
