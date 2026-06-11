import { DriverAccessGate } from "@/components/auth/DriverAccessGate";
import { DriverMessagesView } from "@/components/messaging/DriverMessagesView";

/** Driver inbox only — managers are sent to /manager/messages */
export default function DriverMessagesPage() {
  return (
    <DriverAccessGate callbackUrl="/driver/messages" fieldDriverOnly>
      <DriverMessagesView />
    </DriverAccessGate>
  );
}
