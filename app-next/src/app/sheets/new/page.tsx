import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { NewSheetRedirect } from "./new-sheet-redirect";

export default function NewSheetPage() {
  return (
    <DriverAccessGate callbackUrl="/sheets/new" fieldDriverOnly>
      <NewSheetRedirect />
    </DriverAccessGate>
  );
}
