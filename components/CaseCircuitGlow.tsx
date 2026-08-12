"use client";

import { useEffect } from "react";

export function CaseCircuitGlow() {
  useEffect(() => {
    const casePage = document.querySelector<HTMLElement>(".case-study-page");
    if (!casePage) return;
    const page = casePage;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let fadeTimer: number | null = null;

    function clearFadeTimer() {
      if (fadeTimer) {
        window.clearTimeout(fadeTimer);
        fadeTimer = null;
      }
    }

    function hideGlow() {
      page.classList.remove("is-circuit-active");
    }

    function handlePointerMove(event: PointerEvent) {
      if (prefersReducedMotion || event.pointerType === "touch") return;

      page.style.setProperty("--case-circuit-x", `${event.clientX}px`);
      page.style.setProperty("--case-circuit-y", `${event.clientY}px`);

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const isMutedSection = Boolean(target?.closest(".case-section-muted"));
      page.dataset.circuitTone = isMutedSection ? "muted" : "base";

      clearFadeTimer();
      page.classList.add("is-circuit-active");
      fadeTimer = window.setTimeout(hideGlow, 420);
    }

    function handlePointerLeave() {
      clearFadeTimer();
      hideGlow();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      clearFadeTimer();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      page.classList.remove("is-circuit-active");
      page.removeAttribute("data-circuit-tone");
      page.style.removeProperty("--case-circuit-x");
      page.style.removeProperty("--case-circuit-y");
    };
  }, []);

  return (
    <div className="case-circuit-glow" aria-hidden="true">
      <span />
    </div>
  );
}
