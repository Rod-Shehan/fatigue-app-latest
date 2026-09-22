import { describe, expect, it } from "vitest";
import { canAttemptVideoPlayback, hasViewableVideoClip } from "@/lib/video-clip";

describe("hasViewableVideoClip", () => {
  it("rejects empty, pending, images, and non-http values", () => {
    expect(hasViewableVideoClip(null)).toBe(false);
    expect(hasViewableVideoClip("")).toBe(false);
    expect(hasViewableVideoClip("   ")).toBe(false);
    expect(hasViewableVideoClip("pending://autonomise/clip")).toBe(false);
    expect(hasViewableVideoClip("https://media.example.com/still.jpg")).toBe(false);
    expect(hasViewableVideoClip("not-a-url")).toBe(false);
  });

  it("accepts a real clip URL", () => {
    expect(hasViewableVideoClip("https://media.example.com/clip.mp4")).toBe(true);
    expect(hasViewableVideoClip("https://vendor.example.com/video/abc")).toBe(true);
  });

  it("will still attempt playback for https URLs that are not images", () => {
    expect(canAttemptVideoPlayback("https://autonomise.example.com/GetMedia?id=1")).toBe(true);
    expect(hasViewableVideoClip("https://autonomise.example.com/GetMedia?id=1")).toBe(false);
  });
});
