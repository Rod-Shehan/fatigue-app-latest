import { describe, expect, it } from "vitest";
import {
  matchStrictVoiceIntent,
  matchWakeAndCommand,
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

describe("matchWakeAndCommand", () => {
  it("requires wake + command in one phrase", () => {
    expect(matchWakeAndCommand("Hey Circadia start shift")?.intent).toBe("work");
    expect(matchWakeAndCommand("hey circadia, take a break")?.intent).toBe("break");
    expect(matchWakeAndCommand("hey circadia end shift")?.intent).toBe("stop");
  });

  it("rejects command without wake", () => {
    expect(matchWakeAndCommand("start shift")).toBeNull();
  });

  it("rejects wake alone", () => {
    expect(matchWakeAndCommand("hey circadia")).toBeNull();
  });
});
