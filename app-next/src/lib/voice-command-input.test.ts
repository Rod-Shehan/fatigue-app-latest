import { describe, expect, it } from "vitest";
import {
  matchStrictVoiceIntent,
  matchVoiceConfirmTranscript,
  normalizeVoiceTranscript,
} from "./voice-command-input";

describe("matchStrictVoiceIntent", () => {
  it("matches exact sensible phrases only", () => {
    expect(matchStrictVoiceIntent("start shift")?.intent).toBe("work");
    expect(matchStrictVoiceIntent("start my shift")?.intent).toBe("work");
    expect(matchStrictVoiceIntent("take a break")?.intent).toBe("break");
    expect(matchStrictVoiceIntent("End Shift")?.intent).toBe("stop");
    expect(matchStrictVoiceIntent("finish my shift")?.intent).toBe("stop");
  });

  it("rejects ambiguous one-word commands", () => {
    expect(matchStrictVoiceIntent("work")).toBeNull();
    expect(matchStrictVoiceIntent("break")).toBeNull();
    expect(matchStrictVoiceIntent("stop")).toBeNull();
  });

  it("rejects partial or fuzzy text", () => {
    expect(matchStrictVoiceIntent("please start shift now")).toBeNull();
    expect(matchStrictVoiceIntent("I want a break")).toBeNull();
  });

  it("normalises punctuation", () => {
    const n = normalizeVoiceTranscript("  End Shift! ");
    expect(n).toBe("end shift");
    expect(matchStrictVoiceIntent("  End Shift! ")?.intent).toBe("stop");
  });
});

describe("matchVoiceConfirmTranscript", () => {
  it("matches yes and no phrases", () => {
    expect(matchVoiceConfirmTranscript("yes")).toBe("yes");
    expect(matchVoiceConfirmTranscript("Yeah")).toBe("yes");
    expect(matchVoiceConfirmTranscript("confirm")).toBe("yes");
    expect(matchVoiceConfirmTranscript("no")).toBe("no");
    expect(matchVoiceConfirmTranscript("cancel")).toBe("no");
    expect(matchVoiceConfirmTranscript("no thanks")).toBe("no");
  });

  it("rejects unclear text", () => {
    expect(matchVoiceConfirmTranscript("maybe")).toBeNull();
    expect(matchVoiceConfirmTranscript("")).toBeNull();
  });
});

