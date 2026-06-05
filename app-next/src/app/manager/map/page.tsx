import { redirect } from "next/navigation";
import { getManagerBootstrapSession } from "@/lib/auth";
import { ManagerMapView } from "./manager-map-view";

export default async function ManagerMapPage() {
  const manager = await getManagerBootstrapSession();
  if (!manager) redirect("/login?managerLogin=1&callbackUrl=%2Fmanager%2Fmap");
  return <ManagerMapView />;
}
