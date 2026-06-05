import { redirect } from "next/navigation";
import { getManagerBootstrapSession } from "@/lib/auth";
import { ManagerMessagesView } from "./manager-messages-view";

export default async function ManagerMessagesPage() {
  const manager = await getManagerBootstrapSession();
  if (!manager) redirect("/login?managerLogin=1&callbackUrl=%2Fmanager%2Fmessages");
  return <ManagerMessagesView />;
}

