import { createElement } from "react";

/** React owns configuration; the native element exclusively owns readiness and shadow paint. */
export function StaticCircuitVector({ lensImageUrl, semanticImageUrl, sourceHeight, sourceWidth }: {
  lensImageUrl: string; semanticImageUrl: string; sourceHeight: number; sourceWidth: number;
}) {
  return createElement("public-pcb-art", {
    className: "public-circuit-art",
    "data-semantic-source": semanticImageUrl,
    "data-lens-source": lensImageUrl,
    "data-source-height": String(sourceHeight),
    "data-source-width": String(sourceWidth),
    "data-viewport-state": "pending",
    "data-current-viewport-state": "pending",
    "aria-hidden": "true",
    // Only this host has controller-owned pre-hydration readiness attributes.
    suppressHydrationWarning: true,
  });
}
