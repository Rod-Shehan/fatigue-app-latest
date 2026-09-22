import { describe, expect, it } from "vitest";
import { hasViewableVideoClip } from "@/lib/video-clip";

describe("hasViewableVideoClip", () => {
  it("rejects empty and pending placeholders", () => {
    expect(hasViewableVideoClip(null)).toBe(false);
    expect(hasViewableVideoClip("")).toBe(false);
    expect(hasViewableVideoClip("   ")).toBe(false);
    expect(hasViewableVideoClip("pending://autonomise/clip")).toBe(false);
  });

  it("accepts a real clip URL", () => {
    expect(hasViewableVideoClip("https://media.example.com/clip.mp4")).toBe(true);
  });
});
