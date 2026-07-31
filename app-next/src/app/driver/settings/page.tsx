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
  type LucideIcon,
} from "lucide-react";
import { DriverSettingsOptions } from "./driver-settings-options";
import { DriverSettingsRecordsSection } from "./driver-settings-records";
import { DriverSettingsChangePassword } from "./driver-settings-change-password";
import { DriverSettingsSignOut } from "./driver-settings-sign-out";
import { driverSectionLabel } from "@/components/driver/driver-ui-classes";
import { DriverSettingsDeviceSection } from "@/components/pwa/DriverSettingsDeviceSection";
import { MaintenanceContactSettingsPanel } from "@/components/manager/MaintenanceContactSettingsPanel";
import {
  DRIVER_SETTINGS_CONNECT_LINKS,
  DRIVER_SETTINGS_DRIVE_LINKS,
} from "@/lib/navigation/navigation-links";

const SETTINGS_ICONS: Record<string, LucideIcon> = {
  "this-week": FileText,
  "your-weeks": FileText,
  "driver-guide": BookOpen,
  "driver-help": BookOpen,
  "route-catalogue": MapPin,
  messages: MessageSquare,
  "manager-login": LayoutDashboard,
};

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
    <DriverAccessGate callbackUrl="/driver/settings" fieldDriverOnly>
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

          <MaintenanceContactSettingsPanel title="Workshop contact" />

          <DriverSettingsRecordsSection />

          <section>
            <h2 className={driverSectionLabel}>Drive</h2>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
              {DRIVER_SETTINGS_DRIVE_LINKS.map((row) => {
                const Icon = SETTINGS_ICONS[row.id] ?? FileText;
                return (
                  <SettingsListRow
                    key={row.id}
                    href={row.href}
                    icon={<Icon className="w-5 h-5" />}
                    title={row.title}
                    description={row.description}
                  />
                );
              })}
            </div>
          </section>

          <section>
            <h2 className={driverSectionLabel}>Connect</h2>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
              {DRIVER_SETTINGS_CONNECT_LINKS.map((row) => {
                const Icon = SETTINGS_ICONS[row.id] ?? MessageSquare;
                return (
                  <SettingsListRow
                    key={row.id}
                    href={row.href}
                    icon={<Icon className="w-5 h-5" />}
                    title={row.title}
                    description={row.description}
                  />
                );
              })}
            </div>
          </section>

          <section>
            <h2 className={driverSectionLabel}>Account</h2>
            <div className="space-y-3">
              <DriverSettingsChangePassword />
              <DriverSettingsSignOut />
            </div>
          </section>
        </div>
      </div>
    </div>
    </DriverAccessGate>
  );
}
