import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { RoutesCatalogue } from "@/app/admin/routes/routes-catalogue-admin";

export default function DriverRoutesPage() {
  return (
    <DriverAccessGate callbackUrl="/driver/routes" fieldDriverOnly>
      <RoutesCatalogue backHref="/driver/settings" backLabel="Settings" audience="driver" />
    </DriverAccessGate>
  );
}
