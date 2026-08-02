/** Primary product name for UI, browser metadata, PDFs, and exports. */
export const PRODUCT_NAME = "Circadia24";

/** Line used in print/PDF headers (uppercase). */
export const PRODUCT_NAME_EXPORT = "CIRCADIA24";

/** Public asset paths (see `public/branding/`). */
export const BRAND_ICON_PATH = "/branding/circadia24-icon.png";
export const BRAND_FULL_PATH = "/branding/circadia24-full.png";
/** Full lockup — Helper (legacy combined surface). */
export const BRAND_HELPER_FULL_PATH = "/branding/circadia24-helper-full.png";
export const PRODUCT_NAME_HELPER = "Circadia24 Helper";
/** Full lockup with Enterprise wordmark (manager product lobby). */
export const BRAND_ENTERPRISE_FULL_PATH = "/branding/circadia24-enterprise-full.png";
export const PRODUCT_NAME_ENTERPRISE = "Circadia24 Enterprise";
/** Full lockup with EWD wordmark (driver product lobby). */
export const BRAND_EWD_FULL_PATH = "/branding/circadia24-ewd-full.png";
export const PRODUCT_NAME_EWD = "Circadia24 EWD";

/** Subtitle — sheets list, login, and vehicle-focused contexts. */
export const TAGLINE_VEHICLE = "WA Commercial Vehicle Fatigue Management";

/** Subtitle — weekly record / driver sheet contexts. */
export const TAGLINE_DRIVER = "WA Commercial Driver Fatigue Management";

/** PWA / home-screen icons per surface (Circadia mark + simple name). */
export function pwaIconPathsForSurface(surface: "legacy" | "ewd" | "enterprise") {
  const key = surface === "legacy" ? "helper" : surface;
  return {
    icon192: `/icons/icon-${key}-192.png`,
    icon512: `/icons/icon-${key}-512.png`,
    icon512Maskable: `/icons/icon-${key}-512-maskable.png`,
  };
}
