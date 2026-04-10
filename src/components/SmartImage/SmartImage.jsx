"use client";

import Image from "next/image";

export default function SmartImage({
  src,
  alt,
  fill,
  sizes,
  className,
  loading,
}) {
  if (!src) return null;

  const isCorcisa =
    typeof src === "string" && src.includes("corcisa.com.ar");

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={className}
      loading={loading}
      unoptimized={isCorcisa}
    />
  );
}