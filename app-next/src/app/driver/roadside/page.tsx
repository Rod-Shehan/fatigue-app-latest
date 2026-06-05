import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { DriverRoadsideProducePage } from "./driver-roadside-produce";

export default function DriverRoadsidePage() {
  return (
    <DriverAccessGate callbackUrl="/driver/roadside">
      <DriverRoadsideProducePage />
    </DriverAccessGate>
  );
}
