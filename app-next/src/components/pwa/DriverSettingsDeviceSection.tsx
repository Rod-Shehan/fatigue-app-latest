"use client";

import { useDriverAuth } from "@/hooks/use-driver-auth";
import { DriverDeviceSetupPanel } from "@/components/pwa/DriverDeviceSetupPanel";
import { DriverDeviceBackupPanel } from "@/components/pwa/DriverDeviceBackupPanel";

export function DriverSettingsDeviceSection({ hideHeading = false }: { hideHeading?: boolean }) {
  const { user } = useDriverAuth();
  return (
    <>
      <DriverDeviceSetupPanel hideHeading={hideHeading} />
      <DriverDeviceBackupPanel driverEmail={user?.email} hideHeading={hideHeading} />
    </>
  );
}
