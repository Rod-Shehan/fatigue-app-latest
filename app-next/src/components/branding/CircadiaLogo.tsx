"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND_FULL_PATH, BRAND_ICON_PATH, PRODUCT_NAME } from "@/lib/branding";

type Props = {
  variant: "icon" | "full";
  /** Link target; pass `null` for decorative (non-link) use. Default `/`. */
  href?: string | null;
  className?: string;
  /** Icon variant size in px (default 36). */
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
        width={280}
        height={80}
        priority={priority}
        className={cn("h-auto w-[min(240px,72vw)]", className)}
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
