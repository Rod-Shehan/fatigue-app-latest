import { redirect } from "next/navigation";
import { getOwnerOrBootstrapSession } from "@/lib/auth";
import { OwnerSecurityView } from "./owner-security-view";

export default async function OwnerSecurityPage() {
  const access = await getOwnerOrBootstrapSession();
  if (!access) redirect("/login?ownerLogin=1&callbackUrl=%2Fadmin%2Fsecurity");
  const isOwner = access.user.role === "owner";
  return <OwnerSecurityView isOwner={isOwner} userEmail={access.user.email ?? ""} />;
}
