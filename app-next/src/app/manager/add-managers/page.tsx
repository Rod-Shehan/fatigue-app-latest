import { redirect } from "next/navigation";
import { getManagerBootstrapSession } from "@/lib/auth";
import { AddManagersView } from "./add-managers-view";

export default async function AddManagersPage() {
  const manager = await getManagerBootstrapSession();
  if (!manager) redirect("/sheets");
  return <AddManagersView />;
}
