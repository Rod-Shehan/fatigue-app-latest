import { redirect } from "next/navigation";
import { getManagerBootstrapSession } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ManagerGuideArticle } from "@/components/guides/ManagerGuideArticle";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { PRODUCT_NAME } from "@/lib/branding";
import { MANAGER_EXPERIENCE, MANAGER_PAGE_SHELL } from "@/lib/manager-experience";
import { BookOpen } from "lucide-react";

export default async function ManagerHelpPage() {
  const manager = await getManagerBootstrapSession();
  if (!manager) redirect("/?branch=manager&callbackUrl=%2Fmanager%2Fhelp");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className={MANAGER_PAGE_SHELL}>
        <PageHeader
          backHref="/manager"
          backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
          backText={MANAGER_EXPERIENCE.NAV_OVERVIEW}
          title={PRODUCT_NAME}
          subtitle="Manager user guide"
          icon={<BookOpen className="w-5 h-5" />}
          showLobbyLink={false}
        />
        <ManagerSubnav />
        <ManagerGuideArticle />
      </div>
    </div>
  );
}
