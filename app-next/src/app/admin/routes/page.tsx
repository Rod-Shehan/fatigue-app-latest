import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RoutesCatalogueAdmin } from "./routes-catalogue-admin";

export default async function AdminRoutesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <RoutesCatalogueAdmin />;
}
