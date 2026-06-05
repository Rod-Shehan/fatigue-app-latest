import { getManagerSession } from "@/lib/auth";
import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { SheetDetail } from "./sheet-detail";

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const managerSession = await getManagerSession();
  return (
    <DriverAccessGate callbackUrl={`/sheets/${id}`} allowManager>
      <SheetDetail sheetId={id} canAccessManager={!!managerSession} />
    </DriverAccessGate>
  );
}
