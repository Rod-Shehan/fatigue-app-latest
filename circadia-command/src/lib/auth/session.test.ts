import { describe, expect, it } from "vitest";
import { PERSISTENT_SESSION_MAX_AGE_SEC, signSession, verifySessionToken } from "./session";

describe("command session", () => {
  it("issues tokens without JWT expiry (logout-only sessions)", async () => {
    const token = await signSession({
      operatorId: "op-1",
      name: "Test Operator",
      username: "testop",
      role: "command_operator",
    });

    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"));
    expect(payload.exp).toBeUndefined();

    const session = await verifySessionToken(token);
    expect(session).toEqual({
      sub: "op-1",
      name: "Test Operator",
      username: "testop",
      role: "command_operator",
    });
  });

  it("uses a multi-year cookie max age", () => {
    expect(PERSISTENT_SESSION_MAX_AGE_SEC).toBeGreaterThanOrEqual(365 * 24 * 60 * 60);
  });
});
