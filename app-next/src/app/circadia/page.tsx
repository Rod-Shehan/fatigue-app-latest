import { getPlatformAdminSession, loadAuthUser } from "@/lib/auth";
import { CircadiaClientsView } from "./circadia-clients-view";
import { CircadiaSignIn } from "./circadia-sign-in";

export default async function CircadiaClientsPage() {
  const staff = await getPlatformAdminSession();
  if (!staff) {
    const loaded = await loadAuthUser();
    return <CircadiaSignIn signedInEmail={loaded?.user.email ?? null} />;
  }
  return <CircadiaClientsView staffEmail={staff.user.email ?? ""} />;
}
