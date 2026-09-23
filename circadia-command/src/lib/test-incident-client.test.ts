import { describe, expect, it } from "vitest";
import { jsonProxyResponse } from "@/lib/test-incident-client";

describe("jsonProxyResponse", () => {
  it("passes through valid JSON", async () => {
    const res = jsonProxyResponse(
      new Response("{}", { status: 200 }),
      `{"enabled":true}`,
      "https://example.test/api/internal/test-incident"
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ enabled: true });
  });

  it("wraps Vercel text 404 so the desk does not crash on JSON.parse", async () => {
    const res = jsonProxyResponse(
      new Response("The page could not be found", { status: 404 }),
      "The page could not be found\n\nNOT_FOUND",
      "https://www.circadia24.com/api/internal/test-incident"
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.message).toMatch(/non-JSON/);
    expect(body.message).toMatch(/The page could not be found/);
    expect(body.message).toMatch(/APP_NEXT_URL/);
  });
});
