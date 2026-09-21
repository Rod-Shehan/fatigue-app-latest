import { describe, expect, it } from "vitest";
import { formatYmdAsDmy, parseDmyOrYmdToYmd } from "./au-date";

describe("au-date", () => {
  it("formats ISO calendar days as dd/mm/yyyy", () => {
    expect(formatYmdAsDmy("2026-09-21")).toBe("21/09/2026");
    expect(formatYmdAsDmy("2026-01-05")).toBe("05/01/2026");
    expect(formatYmdAsDmy("")).toBe("");
    expect(formatYmdAsDmy(null)).toBe("");
  });

  it("parses dd/mm/yyyy and rejects US month-first lookalikes that are not real dates", () => {
    expect(parseDmyOrYmdToYmd("21/09/2026")).toBe("2026-09-21");
    expect(parseDmyOrYmdToYmd("5/1/2026")).toBe("2026-01-05");
    expect(parseDmyOrYmdToYmd("2026-09-21")).toBe("2026-09-21");
    expect(parseDmyOrYmdToYmd("31/02/2026")).toBeNull();
    expect(parseDmyOrYmdToYmd("13/13/2026")).toBeNull();
    expect(parseDmyOrYmdToYmd("")).toBeNull();
  });
});
