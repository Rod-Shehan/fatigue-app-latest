import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { PageHeader } from "@/components/PageHeader";
import { SettingsListRow } from "@/components/driver/SettingsListRow";
import { DriverSettingsOverview } from "@/components/driver/DriverSettingsOverview";
import { DriverSettingsSection } from "@/components/driver/DriverSettingsSection";
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
import { DriverSettingsDeviceSection } from "@/components/pwa/DriverSettingsDeviceSection";
import { ChecklistDeliverySettingsPanel } from "@/components/driver/ChecklistDeliverySettingsPanel";
import { MaintenanceContactSettingsPanel } from "@/components/manager/MaintenanceContactSettingsPanel";
import {
  DRIVER_SETTINGS_CONNECT_LINKS,
  DRIVER_SETTINGS_HELP_LINKS,
  DRIVER_SETTINGS_RECORD_LINKS,
} from "@/lib/navigation/navigation-links";
import {
  DRIVER_SETTINGS_PAGE_SUBTITLE,
  DRIVER_SETTINGS_SECTIONS,
} from "@/lib/driver-settings-sections";

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

function SettingsLinkGroup({ links }: { links: typeof DRIVER_SETTINGS_RECORD_LINKS }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
      {links.map((row) => {
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
  );
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

  const device = DRIVER_SETTINGS_SECTIONS.device;
  const delivery = DRIVER_SETTINGS_SECTIONS.delivery;
  const record = DRIVER_SETTINGS_SECTIONS.record;
  const account = DRIVER_SETTINGS_SECTIONS.account;

  return (
    <DriverAccessGate callbackUrl="/driver/settings" fieldDriverOnly>
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="max-w-lg mx-auto px-4 py-8 md:py-10">
        <PageHeader
          backHref={returnHref}
          backLabel={backLabel}
          title="Settings"
          subtitle={DRIVER_SETTINGS_PAGE_SUBTITLE}
          icon={<Settings className="w-5 h-5" />}
        />

        <DriverSettingsOverview />

        <DriverSettingsSection
          id={device.id}
          variant="device"
          eyebrow={device.eyebrow}
          title={device.title}
          subtitle={device.subtitle}
        >
          <DriverSettingsOptions />
          <DriverSettingsDeviceSection hideHeading />
        </DriverSettingsSection>

        <DriverSettingsSection
          id={delivery.id}
          variant="delivery"
          eyebrow={delivery.eyebrow}
          title={delivery.title}
          subtitle={delivery.subtitle}
        >
          <ChecklistDeliverySettingsPanel hideHeading />
          <MaintenanceContactSettingsPanel title="Workshop contact" hideHeading />
        </DriverSettingsSection>

        <DriverSettingsSection
          id={record.id}
          variant="record"
          eyebrow={record.eyebrow}
          title={record.title}
          subtitle={record.subtitle}
        >
          <DriverSettingsRecordsSection hideHeading />
          <SettingsLinkGroup links={DRIVER_SETTINGS_RECORD_LINKS} />
          <SettingsLinkGroup links={DRIVER_SETTINGS_HELP_LINKS} />
        </DriverSettingsSection>

        <DriverSettingsSection
          id={account.id}
          variant="account"
          eyebrow={account.eyebrow}
          title={account.title}
          subtitle={account.subtitle}
        >
          <SettingsLinkGroup links={DRIVER_SETTINGS_CONNECT_LINKS} />
          <DriverSettingsChangePassword />
          <DriverSettingsSignOut />
        </DriverSettingsSection>
      </div>
    </div>
    </DriverAccessGate>
  );
}
