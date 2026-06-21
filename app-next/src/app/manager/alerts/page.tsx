import { redirect } from "next/navigation";
import { getManagerBootstrapSession } from "@/lib/auth";
import { ManagerAlertsView } from "./manager-alerts-view";

export default async function ManagerAlertsPage() {
  const manager = await getManagerBootstrapSession();
  if (!manager) redirect("/?branch=manager&callbackUrl=%2Fmanager%2Falerts");
  return <ManagerAlertsView />;
}
