import { redirect } from "next/navigation";
import { getManagerBootstrapSession } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ManagerGuideArticle } from "@/components/guides/ManagerGuideArticle";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { PRODUCT_NAME } from "@/lib/branding";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { BookOpen } from "lucide-react";

export default async function ManagerHelpPage() {
  const manager = await getManagerBootstrapSession();
  if (!manager) redirect("/?branch=manager&callbackUrl=%2Fmanager%2Fhelp");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <PageHeader
          backHref="/manager"
          backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
          title={PRODUCT_NAME}
          subtitle="Manager user guide"
          icon={<BookOpen className="w-5 h-5" />}
        />
        <ManagerSubnav />
        <ManagerGuideArticle />
      </div>
    </div>
  );
}
