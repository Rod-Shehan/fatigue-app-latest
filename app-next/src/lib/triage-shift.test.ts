import { describe, expect, it } from "vitest";
import {
  formatPerthDateTime,
  isOperatorOnShift,
  isUserOnShift,
  parseAssignees,
  perthLocalInputToUtc,
  validateAssignees,
} from "@/lib/triage-shift";

describe("triage-shift", () => {
  it("parses assignees JSON", () => {
    expect(
      parseAssignees({
        userIds: ["u1", "u1"],
        operatorIds: ["op1"],
        roles: ["manager", "bad"],
      })
    ).toEqual({
      userIds: ["u1"],
      operatorIds: ["op1"],
      roles: ["manager"],
    });
  });

  it("converts Perth local input to UTC", () => {
    const d = perthLocalInputToUtc("2026-06-29T08:00");
    expect(d.toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("formats Perth display", () => {
    const label = formatPerthDateTime("2026-06-29T00:00:00.000Z");
    expect(label).toMatch(/29/);
    expect(label).toMatch(/08:00/);
  });

  it("matches user by id or manager role", () => {
    const a = { userIds: [], operatorIds: [], roles: ["manager" as const] };
    expect(isUserOnShift(a, { userId: "x", userRole: "manager" })).toBe(true);
    expect(isUserOnShift(a, { userId: "x", userRole: "driver" })).toBe(false);
    expect(
      isUserOnShift(
        { userIds: ["u1"], operatorIds: [], roles: [] },
        { userId: "u1", userRole: "driver" }
      )
    ).toBe(true);
  });

  it("matches operator by id or role pool", () => {
    const a = { userIds: [], operatorIds: [], roles: ["command_operator" as const] };
    expect(isOperatorOnShift(a, { operatorId: "any" })).toBe(true);
    expect(
      isOperatorOnShift(
        { userIds: [], operatorIds: ["op1"], roles: [] },
        { operatorId: "op1" }
      )
    ).toBe(true);
  });

  it("requires at least one assignee", () => {
    expect(validateAssignees({ userIds: [], operatorIds: [], roles: [] })).toMatch(/at least/);
    expect(validateAssignees({ userIds: ["u1"], operatorIds: [], roles: [] })).toBeNull();
  });
});
