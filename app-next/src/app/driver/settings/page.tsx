import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME } from "@/lib/branding";
import { SettingsListRow } from "@/components/driver/SettingsListRow";
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Settings,
} from "lucide-react";
import { DriverSettingsOptions } from "./driver-settings-options";
import { DriverSettingsRecordsSection } from "./driver-settings-records";
import { DriverSettingsSignOut } from "./driver-settings-sign-out";
import { driverSectionLabel } from "@/components/driver/driver-ui-classes";
import { DriverSettingsDeviceSection } from "@/components/pwa/DriverSettingsDeviceSection";

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
    <DriverAccessGate callbackUrl="/driver/settings">
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
            <h2 className={driverSectionLabel}>Options</h2>
            <DriverSettingsOptions />
          </section>

          <DriverSettingsDeviceSection />

          <DriverSettingsRecordsSection />

          <section>
            <h2 className={driverSectionLabel}>Drive</h2>
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
                href="/driver/guide"
                icon={<BookOpen className="w-5 h-5" />}
                title="Driver guide (pictures)"
                description="Simple English — sign in, log work, sign your week"
              />
              <SettingsListRow
                href="/driver/help"
                icon={<BookOpen className="w-5 h-5" />}
                title="How your record works"
                description="Short help and rules overview"
              />
              <SettingsListRow
                href="/admin/routes"
                icon={<MapPin className="w-5 h-5" />}
                title="Route catalogue"
                description="Saved run plans — pick on day setup or add your own"
              />
            </div>
          </section>

          <section>
            <h2 className={driverSectionLabel}>Connect</h2>
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
            <h2 className={driverSectionLabel}>Account</h2>
            <DriverSettingsSignOut />
          </section>
        </div>
      </div>
    </div>
    </DriverAccessGate>
  );
}
