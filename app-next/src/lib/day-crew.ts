import type { DayData } from "@/lib/api";

export type DayCrew = {
  driver_type: "solo" | "two_up";
  second_driver: string;
};

type CrewFallback = {
  driver_type?: string | null;
  second_driver?: string | null;
};

/** Day-level crew from Set up day, falling back to sheet header for legacy rows. */
export function resolveDayCrew(
  day: Pick<DayData, "driver_type" | "second_driver"> | undefined,
  fallback: CrewFallback
): DayCrew {
  const dayType = day?.driver_type?.trim();
  const driver_type: "solo" | "two_up" =
    dayType === "two_up" ? "two_up" : dayType === "solo" ? "solo" : fallback.driver_type === "two_up" ? "two_up" : "solo";
  const second_driver = (day?.second_driver ?? fallback.second_driver ?? "").trim();
  return { driver_type, second_driver };
}

export function formatDayCrewLabel(crew: DayCrew): string {
  if (crew.driver_type === "two_up") {
    return crew.second_driver ? `Two-Up · ${crew.second_driver}` : "Two-Up";
  }
  return "Solo";
}
