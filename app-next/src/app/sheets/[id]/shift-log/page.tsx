import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import ShiftLogPage from "./shift-log-page";

export default async function ShiftLogRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DriverAccessGate callbackUrl={`/sheets/${id}/shift-log`} allowManager>
      <ShiftLogPage sheetId={id} />
    </DriverAccessGate>
  );
}
