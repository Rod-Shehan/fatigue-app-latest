import { describe, expect, it } from "vitest";
import {
  isStaffDeskInstallHost,
  productInstallButtonLabel,
  productInstallSurfaceFromHost,
  shouldAttachProductInstallListener,
} from "./product-pwa-install";
import {
  ENTERPRISE_INSTALL_BUTTON_LABEL,
  EWD_INSTALL_BUTTON_LABEL,
  HELPER_INSTALL_BUTTON_LABEL,
} from "./product-copy";

describe("product-pwa-install", () => {
  it("never treats staff desk as a product install host", () => {
    expect(isStaffDeskInstallHost("staff-desk.circadia24.com")).toBe(true);
    expect(isStaffDeskInstallHost("admin.circadia24.com")).toBe(true);
    expect(productInstallSurfaceFromHost("staff-desk.circadia24.com")).toBe(null);
    expect(
      shouldAttachProductInstallListener({
        hostname: "staff-desk.circadia24.com",
        pathname: "/",
      })
    ).toBe(false);
  });

  it("does not attach on /circadia even on a product host", () => {
    expect(
      shouldAttachProductInstallListener({
        hostname: "enterprise.circadia24.com",
        pathname: "/circadia",
      })
    ).toBe(false);
    expect(
      shouldAttachProductInstallListener({
        hostname: "enterprise.circadia24.com",
        pathname: "/manager",
      })
    ).toBe(true);
  });

  it("maps EWD and Enterprise hosts to their own install surfaces", () => {
    expect(productInstallSurfaceFromHost("ewd.circadia24.com")).toBe("ewd");
    expect(productInstallSurfaceFromHost("enterprise.circadia24.com")).toBe("enterprise");
    expect(productInstallSurfaceFromHost("localhost")).toBe("legacy");
    expect(productInstallButtonLabel("ewd")).toBe(EWD_INSTALL_BUTTON_LABEL);
    expect(productInstallButtonLabel("enterprise")).toBe(ENTERPRISE_INSTALL_BUTTON_LABEL);
    expect(productInstallButtonLabel("legacy")).toBe(HELPER_INSTALL_BUTTON_LABEL);
  });
});
