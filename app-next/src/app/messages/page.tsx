import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { MessagesView } from "./messages-view";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=%2Fmessages");
  const manager = await getManagerSession();
  if (manager) redirect("/manager/messages");
  return <MessagesView />;
}

