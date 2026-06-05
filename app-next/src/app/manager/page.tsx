import { redirect } from "next/navigation";
import { getManagerBootstrapSession } from "@/lib/auth";
import { ManagerView } from "./manager-view";

export default async function ManagerPage() {
  const manager = await getManagerBootstrapSession();
  if (!manager) redirect("/login?managerLogin=1&callbackUrl=%2Fmanager");
  return <ManagerView />;
}
