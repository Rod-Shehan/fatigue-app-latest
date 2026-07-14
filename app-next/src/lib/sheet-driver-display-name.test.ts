import { describe, expect, it } from "vitest";
import { resolveSheetDriverDisplayName } from "./sheet-driver-display-name";

describe("resolveSheetDriverDisplayName", () => {
  it("uses sheet name for fleet oversight even when session differs", () => {
    expect(
      resolveSheetDriverDisplayName({
        sheetDriverName: "Pat Driver",
        sessionDisplayName: "Owner Rod",
        isFleetOversight: true,
      })
    ).toBe("Pat Driver");
  });

  it("falls back to em dash when oversight and sheet name empty", () => {
    expect(
      resolveSheetDriverDisplayName({
        sheetDriverName: "  ",
        sessionDisplayName: "Owner Rod",
        isFleetOversight: true,
      })
    ).toBe("—");
  });

  it("prefers session name for field drivers", () => {
    expect(
      resolveSheetDriverDisplayName({
        sheetDriverName: "Stale Sheet Name",
        sessionDisplayName: "Pat Driver",
        isFleetOversight: false,
      })
    ).toBe("Pat Driver");
  });

  it("falls back to sheet name when driver session has no display name", () => {
    expect(
      resolveSheetDriverDisplayName({
        sheetDriverName: "Pat Driver",
        sessionDisplayName: "",
        isFleetOversight: false,
      })
    ).toBe("Pat Driver");
  });

  it("shows ellipsis while driver session is loading", () => {
    expect(
      resolveSheetDriverDisplayName({
        sheetDriverName: "Pat Driver",
        sessionDisplayName: "",
        isFleetOversight: false,
        sessionLoading: true,
      })
    ).toBe("…");
  });
});
