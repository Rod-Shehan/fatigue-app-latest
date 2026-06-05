"use client";

import { useDriverAuth } from "@/hooks/use-driver-auth";
import { DriverDeviceSetupPanel } from "@/components/pwa/DriverDeviceSetupPanel";
import { DriverDeviceBackupPanel } from "@/components/pwa/DriverDeviceBackupPanel";

export function DriverSettingsDeviceSection() {
  const { user } = useDriverAuth();
  return (
    <>
      <DriverDeviceSetupPanel />
      <DriverDeviceBackupPanel driverEmail={user?.email} />
    </>
  );
}
