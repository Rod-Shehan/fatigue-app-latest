import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/auth";
import { RegosAdmin } from "./regos-admin";

export default async function AdminRegosPage() {
  const manager = await getManagerSession();
  if (!manager) redirect("/?branch=manager&callbackUrl=%2Fadmin%2Fregos");
  return <RegosAdmin />;
}
