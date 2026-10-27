"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { canOptimizeImage, isImagePageLink } from "@/lib/imageHosts";

type SiteImageProps = Omit<ImageProps, "src"> & { src?: ImageProps["src"] | null };

/**
 * Drop-in replacement for `next/image`. Images on hosts the optimizer doesn't
 * know (links pasted into the admin Image Manager) are rendered `unoptimized`
 * — loaded directly from their host — instead of crashing the page.
 *
 * The site only shows photos saved in the admin panel. A missing image, a link
 * that can't be shown (a photo's web page such as unsplash.com/photos/…), or a
 * file that fails to load renders as a plain sand-coloured block instead.
 */
export default function SiteImage({ src, alt, unoptimized, onError, fill, width, height, className, style, ...props }: SiteImageProps) {
  const [failedSrc, setFailedSrc] = useState<SiteImageProps["src"]>(null);
  const unusable = !src || (typeof src === "string" && isImagePageLink(src)) || failedSrc === src;
  if (unusable) {
    return (
      <span
        aria-hidden="true"
        className={`${fill ? "absolute inset-0" : "inline-block"} bg-sand ${className ?? ""}`}
        style={fill ? style : { width, height, ...style }}
      />
    );
  }
  const remoteUnknown = typeof src === "string" && !canOptimizeImage(src);
  return (
    <Image
      src={src}
      alt={alt}
      unoptimized={unoptimized || remoteUnknown}
      onError={(event) => {
        setFailedSrc(src);
        onError?.(event);
      }}
      fill={fill}
      width={width}
      height={height}
      className={className}
      style={style}
      {...props}
    />
  );
}
