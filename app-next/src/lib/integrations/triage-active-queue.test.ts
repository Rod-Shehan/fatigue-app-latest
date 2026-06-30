import { describe, expect, it } from "vitest";
import {
  buildQueueBurstLabels,
  type QueueBurstTarget,
} from "@/lib/integrations/triage-active-queue";

describe("triage-active-queue", () => {
  it("labels burst events per rego in chronological order", () => {
    const alerts: QueueBurstTarget[] = [      {
        vehicleRego: "1ITY959",
        receivedAt: "2026-06-30T10:00:00.000Z",
        triggerAt: "2026-06-30T10:00:00.000Z",
      },
      {
        vehicleRego: "1ITY959",
        receivedAt: "2026-06-30T08:00:00.000Z",
        triggerAt: "2026-06-30T08:00:00.000Z",
      },
    ];

    buildQueueBurstLabels(alerts);

    expect(alerts[0].queueBurstLabel).toBe("Event 2 of 2 for 1ITY959 in active queue");
    expect(alerts[1].queueBurstLabel).toBe("Event 1 of 2 for 1ITY959 in active queue");
  });
});
