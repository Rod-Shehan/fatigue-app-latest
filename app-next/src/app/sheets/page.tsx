import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { SheetsList } from "./sheets-list";

export default function SheetsPage() {
  return (
    <DriverAccessGate callbackUrl="/sheets" fieldDriverOnly>
      <SheetsList />
    </DriverAccessGate>
  );
}
