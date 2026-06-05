import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import SheetCompliancePage from "./sheet-compliance-page";

export default async function CompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DriverAccessGate callbackUrl={`/sheets/${id}/compliance`}>
      <SheetCompliancePage sheetId={id} />
    </DriverAccessGate>
  );
}
