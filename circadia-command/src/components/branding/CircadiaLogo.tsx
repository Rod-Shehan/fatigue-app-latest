"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import { PRODUCT_NAME } from "@/lib/branding";

const BRAND_LIGHT_FULL_PATH = "/branding/circadia24-full.png";
const BRAND_LIGHT_ICON_PATH = "/branding/circadia24-icon.png";
const BRAND_DARK_FULL_PATH = "/branding/circadia24-command-dark-full.png";
const BRAND_DARK_ICON_PATH = "/branding/circadia24-command-dark-icon.png";
const BRAND_ASSET_VERSION = "command-wordmark-v4";

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
  const { resolved } = useTheme();
  const isDark = resolved === "dark";
  const fullPath = isDark ? BRAND_DARK_FULL_PATH : BRAND_LIGHT_FULL_PATH;
  const iconPath = isDark ? BRAND_DARK_ICON_PATH : BRAND_LIGHT_ICON_PATH;
  const fullWidth = isDark ? 1024 : 878;
  const fullHeight = isDark ? 344 : 372;

  const image =
    variant === "full" ? (
      <Image
        src={`${fullPath}?v=${BRAND_ASSET_VERSION}`}
        alt={PRODUCT_NAME}
        width={fullWidth}
        height={fullHeight}
        priority={priority}
        unoptimized
        className={cn("h-auto w-[min(320px,85vw)]", className)}
      />
    ) : (
      <Image
        src={`${iconPath}?v=${BRAND_ASSET_VERSION}`}
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
