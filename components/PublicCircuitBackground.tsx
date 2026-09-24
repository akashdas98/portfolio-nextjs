"use client";

import { useEffect, useRef, useState } from "react";
import { DesktopCircuitInteraction } from "@/components/public-circuit/DesktopCircuitInteraction";
import { StaticCircuitVector } from "@/components/public-circuit/StaticCircuitVector";
import { TouchCanvasInteraction } from "@/components/public-circuit/TouchCanvasInteraction";
import {
  type InitialPointerInput,
  type PublicCircuitBackgroundProps,
} from "@/components/public-circuit/shared";
import { isPublicTouchEnabled } from "@/lib/pcb/touch-interaction";

const PUBLIC_TOUCH_ENABLED = isPublicTouchEnabled(process.env.NODE_ENV);

export function PublicCircuitBackground(props: PublicCircuitBackgroundProps) {
  const [interactionMounted, setInteractionMounted] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(true);
  const initialInput = useRef<InitialPointerInput | null>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setMotionAllowed(!preference.matches);
    updateMotion();
    preference.addEventListener("change", updateMotion);
    return () => preference.removeEventListener("change", updateMotion);
  }, []);
  useEffect(() => {
    if (interactionMounted || !motionAllowed) return;
    function requestPointerInteraction(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      initialInput.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      };
      setInteractionMounted(true);
    }
    function leavePointer() {
      initialInput.current = null;
    }
    // The initial server/client tree contains only the static art host. The
    // decorative interaction shell is an enhancement, mounted once on demand;
    // capture the first input so mounting cannot discard that interaction.
    const warmup = window.matchMedia("(hover: hover) and (pointer: fine)").matches
      ? window.setTimeout(() => setInteractionMounted(true), 1_200) : null;
    window.addEventListener("pointermove", requestPointerInteraction, { passive: true });
    window.addEventListener("pointerleave", leavePointer);
    return () => {
      if (warmup !== null) window.clearTimeout(warmup);
      window.removeEventListener("pointermove", requestPointerInteraction);
      window.removeEventListener("pointerleave", leavePointer);
    };
  }, [interactionMounted, motionAllowed]);

  return (
    <>
      <StaticCircuitVector
        lensImageUrl={props.lensImageUrl ?? props.imageUrl}
        semanticImageUrl={props.imageUrl}
        sourceHeight={props.sourceHeight}
        sourceWidth={props.sourceWidth}
      />
      {interactionMounted && motionAllowed && (
        <DesktopCircuitInteraction {...props} initialInput={initialInput} />
      )}
      {PUBLIC_TOUCH_ENABLED && motionAllowed && <TouchCanvasInteraction {...props} />}
    </>
  );
}
