"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const BRAND_ICON_PATH = "/branding/circadia24-command-icon.png";
const BRAND_FULL_PATH = "/branding/circadia24-command-full.png";
const PRODUCT_NAME = "Circadia 24 Command";

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
        src={BRAND_FULL_PATH}
        alt={PRODUCT_NAME}
        width={878}
        height={372}
        priority={priority}
        className={cn("h-auto w-[min(320px,85vw)]", className)}
      />
    ) : (
      <Image
        src={BRAND_ICON_PATH}
        alt=""
        width={size}
        height={size}
        priority={priority}
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
