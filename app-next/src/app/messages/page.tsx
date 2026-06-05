import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";

/**
 * Legacy /messages URL: managers → manager inbox; drivers → canonical driver inbox.
 */
export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/?branch=driver&callbackUrl=%2Fmessages");
  const manager = await getManagerSession();
  if (manager) redirect("/manager/messages");
  redirect("/driver/messages");
}
