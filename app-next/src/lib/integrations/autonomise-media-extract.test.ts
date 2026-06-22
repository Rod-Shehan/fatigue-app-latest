import { describe, expect, it } from "vitest";
import {
  extractMediaFromJson,
  pickBestMediaUrl,
  scanMediaUrlsFromJson,
} from "@/lib/integrations/autonomise-media-extract";

describe("autonomise-media-extract", () => {
  it("prefers event video over snapshots", () => {
    const best = pickBestMediaUrl({
      eventVideoUrl: "https://cdn.example/clip.mp4",
      driverCameraUrl: "https://cdn.example/driver.jpg",
      roadCameraUrl: "https://cdn.example/road.jpg",
    });
    expect(best).toBe("https://cdn.example/clip.mp4");
  });

  it("extracts driver and road urls from API-shaped JSON", () => {
    const parsed = extractMediaFromJson({
      driverCameraUrl: "https://cdn.example/driver.jpg",
      roadCameraUrl: "https://cdn.example/road.jpg",
    });
    expect(parsed.driverCameraUrl).toContain("driver");
    expect(parsed.roadCameraUrl).toContain("road");
  });

  it("prefers Internal driver channel video over External forward when forward is listed first", () => {
    const parsed = extractMediaFromJson({
      media: [
        {
          uri: "https://cdn.example/forward.mp4",
          mimeType: "video/mp4",
          channelLabel: "External",
          channel: 0,
        },
        {
          uri: "https://cdn.example/driver.mp4",
          mimeType: "video/mp4",
          channelLabel: "Internal",
          channel: 1,
        },
      ],
      missing: [],
    });
    expect(pickBestMediaUrl(parsed)).toBe("https://cdn.example/driver.mp4");
    expect(parsed.roadCameraUrl).toBe("https://cdn.example/forward.mp4");
  });

  it("extracts documented Autonomise device media API response (media[].uri)", () => {
    const parsed = extractMediaFromJson({
      media: [
        {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          uri: "https://cdn.example/internal-clip.mp4",
          mimeType: "video/mp4",
          channelLabel: "Internal",
        },
        {
          uri: "https://cdn.example/driver.jpg",
          mimeType: "image/jpeg",
          channelLabel: "Internal",
        },
      ],
      missing: [],
    });
    expect(parsed.eventVideoUrl).toBe("https://cdn.example/internal-clip.mp4");
    expect(parsed.driverCameraUrl).toBe("https://cdn.example/internal-clip.mp4");
    expect(pickBestMediaUrl(parsed)).toBe("https://cdn.example/internal-clip.mp4");
  });

  it("deep-scans unknown media webhook JSON for https urls", () => {
    const parsed = scanMediaUrlsFromJson({
      nested: { driverFace: "https://cdn.example/dsm-snap.jpg" },
    });
    expect(parsed.driverCameraUrl).toBe("https://cdn.example/dsm-snap.jpg");
  });
});
