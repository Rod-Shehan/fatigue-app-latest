"use client";

import { useEffect } from "react";
import { attachProductPwaInstallListener } from "@/lib/product-pwa-install";

/** Captures the product (EWD / Enterprise / Helper) install prompt early. Never used on staff desk. */
export function ProductPwaInstallCapture() {
  useEffect(() => {
    attachProductPwaInstallListener();
  }, []);
  return null;
}
