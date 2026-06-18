"use client";

import { useState } from "react";
import {
  DRIVER_ACTION_RING_MASK_FALLBACK_PATH,
  DRIVER_ACTION_RING_MASK_PATH,
} from "@/lib/driver-action-ring";
import { cn } from "@/lib/utils";

export function DriverActionHeroRing({
  tintClass,
  spin,
  className,
}: {
  tintClass: string;
  /** True during break (and not compact / reduced-motion). */
  spin: boolean;
  className?: string;
}) {
  const [maskSrc, setMaskSrc] = useState(DRIVER_ACTION_RING_MASK_PATH);
  const maskUrl = `url("${maskSrc}")`;

  return (
    <>
      <img
        src={maskSrc}
        alt=""
        className="hidden"
        onError={() => {
          if (maskSrc !== DRIVER_ACTION_RING_MASK_FALLBACK_PATH) {
            setMaskSrc(DRIVER_ACTION_RING_MASK_FALLBACK_PATH);
          }
        }}
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-[6%] rounded-full pointer-events-none z-0 opacity-85",
          tintClass,
          spin && "animate-driver-action-ring motion-reduce:animate-none",
          className
        )}
        style={{
          WebkitMaskImage: maskUrl,
          maskImage: maskUrl,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
    </>
  );
}
