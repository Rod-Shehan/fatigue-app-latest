"use client";

import { useCallback, useEffect, useState } from "react";
import { isStandaloneDisplay, isiOS } from "@/lib/device-setup";
import {
  attachProductPwaInstallListener,
  hasDeferredProductInstallPrompt,
  productInstallButtonLabel,
  productInstallSurfaceFromHost,
  promptProductInstall,
  subscribeProductInstall,
  type ProductInstallOutcome,
  type ProductInstallSurface,
} from "@/lib/product-pwa-install";

export function useProductPwaInstall() {
  const [surface, setSurface] = useState<ProductInstallSurface>("legacy");
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    attachProductPwaInstallListener();
    setSurface(productInstallSurfaceFromHost(window.location.host) ?? "legacy");
    setInstalled(isStandaloneDisplay());
    setIos(isiOS());
    setCanPrompt(hasDeferredProductInstallPrompt());
    return subscribeProductInstall(() => {
      setCanPrompt(hasDeferredProductInstallPrompt());
      setInstalled(isStandaloneDisplay());
    });
  }, []);

  const promptInstall = useCallback((): Promise<ProductInstallOutcome> => {
    return promptProductInstall();
  }, []);

  return {
    surface,
    canPrompt,
    installed,
    ios,
    installLabel: productInstallButtonLabel(surface),
    promptInstall,
  };
}
