import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/auth";
import { DriversList } from "./drivers-list";

export default async function DriversPage() {
  const manager = await getManagerSession();
  if (!manager) redirect("/?branch=manager&callbackUrl=%2Fdrivers");
  return <DriversList />;
}
