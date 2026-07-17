"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  BRAND_ENTERPRISE_FULL_PATH,
  BRAND_EWD_FULL_PATH,
  BRAND_FULL_PATH,
  BRAND_ICON_PATH,
  PRODUCT_NAME,
  PRODUCT_NAME_ENTERPRISE,
  PRODUCT_NAME_EWD,
} from "@/lib/branding";

type Props = {
  variant: "icon" | "full";
  /** Product lockup for full variant (default Circadia 24). */
  product?: "default" | "enterprise" | "ewd";
  /** Link target; pass `null` for decorative (non-link) use. Default `/`. */
  href?: string | null;
  className?: string;
  /** Icon variant size in px (default 36). */
  size?: number;
  priority?: boolean;
};

function fullBrand(product: Props["product"]) {
  if (product === "enterprise") {
    return {
      src: BRAND_ENTERPRISE_FULL_PATH,
      label: PRODUCT_NAME_ENTERPRISE,
      width: 420,
      height: 120,
      className: "w-[min(320px,85vw)] rounded-xl",
    };
  }
  if (product === "ewd") {
    return {
      src: BRAND_EWD_FULL_PATH,
      label: PRODUCT_NAME_EWD,
      width: 420,
      height: 120,
      className: "w-[min(320px,85vw)] rounded-xl",
    };
  }
  return {
    src: BRAND_FULL_PATH,
    label: PRODUCT_NAME,
    width: 280,
    height: 80,
    className: "w-[min(240px,72vw)]",
  };
}

export function CircadiaLogo({
  variant,
  product = "default",
  href = "/",
  className,
  size = 36,
  priority = false,
}: Props) {
  const full = fullBrand(product);
  const label = variant === "full" ? full.label : PRODUCT_NAME;

  const image =
    variant === "full" ? (
      <Image
        src={full.src}
        alt={label}
        width={full.width}
        height={full.height}
        priority={priority}
        className={cn("h-auto", full.className, className)}
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
        aria-label={label}
        title={label}
      >
        {image}
      </Link>
    );
  }

  return <span className={cn("inline-flex shrink-0 items-center", className)}>{image}</span>;
}
