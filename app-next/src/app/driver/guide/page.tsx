import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { DriverGuideArticle } from "@/components/guides/DriverGuideArticle";
import { PRODUCT_NAME, TAGLINE_DRIVER } from "@/lib/branding";
import { BookOpen } from "lucide-react";

export default async function DriverGuidePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=%2Fdriver%2Fguide");
  const manager = await getManagerSession();
  if (manager) redirect("/manager");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-10">
        <PageHeader
          backHref="/driver/settings"
          backLabel="Settings"
          title={PRODUCT_NAME}
          subtitle="Driver guide — simple English with pictures"
          icon={<BookOpen className="w-5 h-5" />}
        />
        <DriverGuideArticle />
      </div>
    </div>
  );
}
