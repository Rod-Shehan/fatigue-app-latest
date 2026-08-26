import { redirect } from "next/navigation";
import { getManagerBootstrapSession } from "@/lib/auth";
import { ManagerRecordsView } from "./manager-records-view";

export default async function ManagerRecordsPage() {
  const manager = await getManagerBootstrapSession();
  if (!manager) redirect("/?branch=manager&callbackUrl=%2Fmanager%2Frecords");
  return <ManagerRecordsView />;
}
