import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { DriverHome } from "./driver-home";

export default function DriverHomePage() {
  return (
    <DriverAccessGate callbackUrl="/driver" fieldDriverOnly>
      <DriverHome />
    </DriverAccessGate>
  );
}
