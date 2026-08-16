import { redirect } from "next/navigation";
import { getOwnerOrBootstrapSession } from "@/lib/auth";
import { isPlatformAdminUser } from "@/lib/tenant";
import { OwnerSecurityView } from "./owner-security-view";

export default async function OwnerSecurityPage() {
  const access = await getOwnerOrBootstrapSession();
  if (!access) redirect("/?branch=owner&callbackUrl=%2Fadmin%2Fsecurity&error=owner_required");
  const isOwner = access.user.role === "owner";
  return (
    <OwnerSecurityView
      isOwner={isOwner}
      isPlatformAdmin={isPlatformAdminUser(access.user)}
      userEmail={access.user.email ?? ""}
      currentUserId={access.user.id}
    />
  );
}
