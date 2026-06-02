import { redirect } from "next/navigation";

export default async function DriverMoreRedirect({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  if (from && from.startsWith("/") && !from.startsWith("//")) {
    redirect(`/driver/settings?from=${encodeURIComponent(from)}`);
  }
  redirect("/driver/settings");
}
