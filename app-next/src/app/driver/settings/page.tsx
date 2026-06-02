import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME } from "@/lib/branding";
import { SettingsListRow } from "@/components/driver/SettingsListRow";
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from "lucide-react";
import { DriverSettingsOptions } from "./driver-settings-options";
import { DriverSettingsSignOut } from "./driver-settings-sign-out";

const MANAGER_LOGIN_HREF = `/login?callbackUrl=${encodeURIComponent("/manager")}&managerLogin=1`;

function safeReturnPath(from: string | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return "/driver";
  return from;
}

export default async function DriverSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=%2Fdriver%2Fsettings");
  const manager = await getManagerSession();
  if (manager) redirect("/manager");

  const { from } = await searchParams;
  const returnHref = safeReturnPath(from);
  const backLabel =
    returnHref === "/driver"
      ? "Drive home"
      : returnHref === "/sheets"
        ? "Your weeks"
        : returnHref.startsWith("/sheets/")
          ? "This week"
          : "Back";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-8 md:py-10">
        <PageHeader
          backHref={returnHref}
          backLabel={backLabel}
          title="Settings"
          subtitle={PRODUCT_NAME}
          icon={<Settings className="w-5 h-5" />}
        />

        <div className="space-y-6">
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
              Options
            </h2>
            <DriverSettingsOptions />
          </section>

          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
              Drive
            </h2>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
              <SettingsListRow
                href="/driver"
                icon={<FileText className="w-5 h-5" />}
                title="This week"
                description="Open your current week and log work"
              />
              <SettingsListRow
                href="/sheets"
                icon={<FileText className="w-5 h-5" />}
                title="Your weeks"
                description="Past and signed weekly records"
              />
              <SettingsListRow
                href="/driver/help"
                icon={<BookOpen className="w-5 h-5" />}
                title="How your record works"
                description="Plain-language guide and rules overview"
              />
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
              Connect
            </h2>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
              <SettingsListRow
                href="/driver/messages"
                icon={<MessageSquare className="w-5 h-5" />}
                title="Messages"
              />
              <SettingsListRow
                href={MANAGER_LOGIN_HREF}
                icon={<LayoutDashboard className="w-5 h-5" />}
                title="Manager"
                description="Manager sign-in"
              />
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
              Account
            </h2>
            <DriverSettingsSignOut />
          </section>
        </div>
      </div>
    </div>
  );
}
