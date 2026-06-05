import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { PageHeader } from "@/components/PageHeader";
import { DriverGuideArticle } from "@/components/guides/DriverGuideArticle";
import { PRODUCT_NAME, TAGLINE_DRIVER } from "@/lib/branding";
import { BookOpen } from "lucide-react";

function safeReturnPath(from: string | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return "/driver/settings";
  return from;
}

function backLabelFor(path: string): string {
  if (path === "/driver") return "Drive home";
  if (path === "/sheets") return "Your weeks";
  if (path.startsWith("/sheets/")) return "This week";
  return "Back";
}

export default async function DriverGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = safeReturnPath(from);
  const backLabel = backLabelFor(backHref);

  return (
    <DriverAccessGate callbackUrl="/driver/guide">
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-10">
          <PageHeader
            backHref={backHref}
            backLabel={backLabel}
            title={PRODUCT_NAME}
            subtitle="User manual — simple English with pictures"
            icon={<BookOpen className="w-5 h-5" />}
          />
          <DriverGuideArticle />
        </div>
      </div>
    </DriverAccessGate>
  );
}
