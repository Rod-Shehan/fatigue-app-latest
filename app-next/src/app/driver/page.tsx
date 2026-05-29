import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { DriverHomeRedirect } from "./driver-home-redirect";

export default async function DriverHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=%2Fdriver");
  const manager = await getManagerSession();
  if (manager) redirect("/manager");
  return <DriverHomeRedirect />;
}
