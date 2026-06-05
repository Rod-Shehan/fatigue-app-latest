import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/auth";
import { RoutesCatalogueAdmin } from "./routes-catalogue-admin";

export default async function AdminRoutesPage() {
  const manager = await getManagerSession();
  if (!manager) redirect("/?branch=manager&callbackUrl=%2Fadmin%2Froutes");
  return <RoutesCatalogueAdmin />;
}
