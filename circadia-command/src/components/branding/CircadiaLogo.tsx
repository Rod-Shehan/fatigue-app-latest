"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";

const BRAND_FULL_PATH = "/branding/circadia24-command-full.png";
const BRAND_ICON_PATH = "/branding/circadia24-icon.png";
const BRAND_ASSET_VERSION = "circadia-mark-v2";

type Props = {
  variant: "icon" | "full";
  href?: string | null;
  className?: string;
  size?: number;
  priority?: boolean;
};

export function CircadiaLogo({
  variant,
  href = "/",
  className,
  size = 36,
  priority = false,
}: Props) {
  const image =
    variant === "full" ? (
      <Image
        src={`${BRAND_FULL_PATH}?v=${BRAND_ASSET_VERSION}`}
        alt={PRODUCT_NAME}
        width={720}
        height={560}
        priority={priority}
        unoptimized
        className={cn("h-auto w-[min(280px,78vw)] rounded-xl", className)}
      />
    ) : (
      <Image
        src={`${BRAND_ICON_PATH}?v=${BRAND_ASSET_VERSION}`}
        alt=""
        width={size}
        height={size}
        priority={priority}
        unoptimized
        className={cn("rounded-lg object-contain", className)}
        style={{ width: size, height: size }}
      />
    );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 items-center"
        aria-label={PRODUCT_NAME}
        title={PRODUCT_NAME}
      >
        {image}
      </Link>
    );
  }

  return <span className={cn("inline-flex shrink-0 items-center", className)}>{image}</span>;
}
