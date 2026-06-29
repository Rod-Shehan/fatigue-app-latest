import { describe, expect, it } from "vitest";
import {
  extractDriverFromJson,
  extractMediaFromJson,
  extractVehicleFromJson,
  pickBestMediaUrl,
  pickReviewMediaUrl,
  resolveReviewMediaUrl,
  scanMediaUrlsFromJson,
} from "@/lib/integrations/autonomise-media-extract";

describe("autonomise-media-extract", () => {
  it("prefers driver snapshot over forward event video for DSM review", () => {
    const best = pickBestMediaUrl({
      eventVideoUrl: "https://cdn.example/forward-clip.mp4",
      driverCameraUrl: "https://cdn.example/driver.jpg",
      roadCameraUrl: "https://cdn.example/forward-clip.mp4",
    });
    expect(best).toBe("https://cdn.example/driver.jpg");
  });

  it("pickReviewMediaUrl uses road clip for ADAS alarms", () => {
    const urls = {
      eventVideoUrl: "https://cdn.example/forward.mp4",
      driverCameraUrl: "https://cdn.example/driver.mp4",
      roadCameraUrl: "https://cdn.example/forward.mp4",
    };
    expect(pickReviewMediaUrl(urls, "VT3600AI_ALARM_DSM_Fatigue")).toBe(
      "https://cdn.example/driver.mp4"
    );
    expect(pickReviewMediaUrl(urls, "VT3600AI_ALARM_ADAS_LaneDeparture")).toBe(
      "https://cdn.example/forward.mp4"
    );
  });

  it("resolveReviewMediaUrl swaps stored forward URL for DSM when payload has both cameras", () => {
    const payload = {
      media: [
        {
          uri: "https://cdn.example/forward.mp4",
          mimeType: "video/mp4",
          channelLabel: "Forward",
          channel: 0,
        },
        {
          uri: "https://cdn.example/driver.mp4",
          mimeType: "video/mp4",
          channelLabel: "Driver",
          channel: 2,
        },
      ],
    };
    expect(
      resolveReviewMediaUrl(
        payload,
        "VT3600AI_ALARM_DSM_Fatigue",
        "https://cdn.example/forward.mp4"
      )
    ).toBe("https://cdn.example/driver.mp4");
  });

  it("extracts driver and road urls from API-shaped JSON", () => {
    const parsed = extractMediaFromJson({
      driverCameraUrl: "https://cdn.example/driver.jpg",
      roadCameraUrl: "https://cdn.example/road.jpg",
    });
    expect(parsed.driverCameraUrl).toContain("driver");
    expect(parsed.roadCameraUrl).toContain("road");
  });

  it("prefers VT3600 channel 2 Driver over Forward and Internal centre", () => {
    const parsed = extractMediaFromJson({
      media: [
        {
          uri: "https://cdn.example/forward.mp4",
          mimeType: "video/mp4",
          channelLabel: "Forward",
          channel: 0,
          mediaType: 3,
        },
        {
          uri: "https://cdn.example/internal.mp4",
          mimeType: "video/mp4",
          channelLabel: "Internal",
          channel: 1,
          mediaType: 3,
        },
        {
          uri: "https://cdn.example/driver.mp4",
          mimeType: "video/mp4",
          channelLabel: "Driver",
          channel: 2,
          mediaType: 3,
        },
      ],
      missing: [],
    });
    expect(pickBestMediaUrl(parsed)).toBe("https://cdn.example/driver.mp4");
    expect(parsed.roadCameraUrl).toBe("https://cdn.example/forward.mp4");
  });

  it("accepts unlabelled media[] video entries from Autonomise API", () => {
    const parsed = extractMediaFromJson({
      media: [
        {
          uri: "https://cdn.example/unlabelled-clip.mp4",
          mimeType: "video/mp4",
          mediaType: 3,
        },
      ],
      missing: [],
    });
    expect(pickBestMediaUrl(parsed)).toBe("https://cdn.example/unlabelled-clip.mp4");
  });

  it("extracts documented Autonomise device media API response (media[].uri)", () => {
    const parsed = extractMediaFromJson({
      media: [
        {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          uri: "https://cdn.example/driver-clip.mp4",
          mimeType: "video/mp4",
          channelLabel: "Driver",
          channel: 2,
          mediaType: 3,
        },
        {
          uri: "https://cdn.example/driver.jpg",
          mimeType: "image/jpeg",
          channelLabel: "Driver",
          channel: 2,
        },
      ],
      missing: [],
    });
    expect(parsed.eventVideoUrl).toBe("https://cdn.example/driver-clip.mp4");
    expect(parsed.driverCameraUrl).toBe("https://cdn.example/driver-clip.mp4");
    expect(pickBestMediaUrl(parsed)).toBe("https://cdn.example/driver-clip.mp4");
  });

  it("deep-scans unknown media webhook JSON for https urls", () => {
    const parsed = scanMediaUrlsFromJson({
      nested: { driverFace: "https://cdn.example/dsm-snap.jpg" },
    });
    expect(parsed.driverCameraUrl).toBe("https://cdn.example/dsm-snap.jpg");
  });

  it("extracts VRN and driver id from Autonomise vehicle API shape", () => {
    const parsed = extractVehicleFromJson({
      id: "e82f7ba8-759f-f011-8e62-6045bdfcbf17",
      vrn: "1ITY959",
      make: "UD",
      model: "QUON",
      driver: { id: "5eaa5163-11f0-f011-832e-6045bd11ae66" },
    });
    expect(parsed.vehicleRego).toBe("1ITY959");
    expect(parsed.driverId).toBe("5eaa5163-11f0-f011-832e-6045bd11ae66");
    expect(parsed.makeModel).toBe("UD QUON");
  });

  it("composes driver name from first and last name", () => {
    const parsed = extractDriverFromJson({
      firstName: "Rod",
      lastName: "Shehan",
      phoneNumber: "0458846442",
    });
    expect(parsed.driverName).toBe("Rod Shehan");
    expect(parsed.driverPhone).toBe("0458846442");
  });
});
