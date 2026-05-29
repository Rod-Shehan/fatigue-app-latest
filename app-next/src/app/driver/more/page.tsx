import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME, TAGLINE_DRIVER } from "@/lib/branding";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
} from "lucide-react";
import { DriverMoreSignOutButton } from "./driver-more-sign-out";

const MANAGER_LOGIN_HREF = `/login?callbackUrl=${encodeURIComponent("/manager")}&managerLogin=1`;

function LinkRow({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "h-auto w-full justify-between gap-3 px-4 py-3 text-left font-normal border-slate-200 dark:border-slate-700"
      )}
    >
      <span className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
          {description && (
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
              {description}
            </span>
          )}
        </span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />
    </Link>
  );
}

export default async function DriverMorePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=%2Fdriver%2Fmore");
  const manager = await getManagerSession();
  if (manager) redirect("/manager");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-8 md:py-10">
        <PageHeader
          backHref="/driver"
          backLabel="This week"
          title="More"
          subtitle={PRODUCT_NAME}
          icon={<Menu className="w-5 h-5" />}
        />

        <div className="space-y-6">
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Drive
            </h2>
            <div className="space-y-2">
              <LinkRow
                href="/driver"
                icon={<FileText className="w-4 h-4" />}
                title="This week"
                description="Open your current week and log work"
              />
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Records
            </h2>
            <div className="space-y-2">
              <LinkRow
                href="/sheets"
                icon={<FileText className="w-4 h-4" />}
                title="Your weeks"
                description="Past and signed weekly records"
              />
              <LinkRow
                href="/driver/help"
                icon={<BookOpen className="w-4 h-4" />}
                title="How your record works"
                description="Plain-language guide and rules overview"
              />
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Connect
            </h2>
            <div className="space-y-2">
              <LinkRow
                href="/driver/messages"
                icon={<MessageSquare className="w-4 h-4" />}
                title="Messages"
              />
              <LinkRow
                href={MANAGER_LOGIN_HREF}
                icon={<LayoutDashboard className="w-4 h-4" />}
                title="Manager"
                description="Manager sign-in"
              />
            </div>
          </section>

          <DriverMoreSignOutButton />
        </div>
      </div>
    </div>
  );
}
