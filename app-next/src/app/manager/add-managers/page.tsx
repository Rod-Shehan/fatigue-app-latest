import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/auth";
import { AddManagersView } from "./add-managers-view";

export default async function AddManagersPage() {
  const owner = await getOwnerSession();
  if (!owner) redirect("/?branch=owner&callbackUrl=%2Fmanager%2Fadd-managers");
  return <AddManagersView />;
}
