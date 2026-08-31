"use client";

import { useEffect, useId, useRef } from "react";
import type { CSSProperties } from "react";

type PublicCircuitBackgroundProps = {
  imageUrl: string;
  lensImageUrl?: string;
  sourceWidth: number;
  sourceHeight: number;
};

const LENS_DIAMETER = 330;
const LENS_RADIUS = LENS_DIAMETER / 2;
const MUTED_SECTION_SELECTOR = ".case-section-muted, .selected-work-section";

type ToneRange = {
  bottom: number;
  top: number;
};

function rectPath(top: number, bottom: number) {
  return `M0 ${top}H${LENS_DIAMETER}V${bottom}H0Z`;
}

export function PublicCircuitBackground({
  imageUrl,
  lensImageUrl = imageUrl,
  sourceWidth,
  sourceHeight,
}: PublicCircuitBackgroundProps) {
  const instanceId = useId().replaceAll(":", "");
  const artRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<SVGSVGElement>(null);
  const geometryTransformRef = useRef<SVGGElement>(null);
  const geometryRef = useRef<SVGImageElement>(null);
  const baseClipRef = useRef<SVGPathElement>(null);
  const mutedClipRef = useRef<SVGPathElement>(null);
  const blueEnvelopeGradientId = `${instanceId}-circuit-blue-envelope-gradient`;
  const pinkEnvelopeGradientId = `${instanceId}-circuit-pink-envelope-gradient`;
  const blueEnvelopeMaskId = `${instanceId}-circuit-blue-envelope-mask`;
  const pinkEnvelopeMaskId = `${instanceId}-circuit-pink-envelope-mask`;
  const geometryMaskId = `${instanceId}-circuit-geometry`;
  const baseClipId = `${instanceId}-circuit-base-tone`;
  const mutedClipId = `${instanceId}-circuit-muted-tone`;

  useEffect(() => {
    const art = artRef.current;
    const lens = lensRef.current;
    const geometryTransform = geometryTransformRef.current;
    const geometry = geometryRef.current;
    const baseClip = baseClipRef.current;
    const mutedClip = mutedClipRef.current;
    const page = art?.closest<HTMLElement>("[data-public-circuit]");
    if (
      !art ||
      !lens ||
      !geometryTransform ||
      !geometry ||
      !baseClip ||
      !mutedClip ||
      !page
    ) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const supportsFinePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    if (prefersReducedMotion || !supportsFinePointer) return;

    const pageElement = page;
    const lensElement = lens;
    const geometryTransformElement = geometryTransform;
    const geometryElement = geometry;
    const baseClipElement = baseClip;
    const mutedClipElement = mutedClip;
    let fadeTimer: number | null = null;
    let layoutFrame: number | null = null;
    let pointerFrame: number | null = null;
    let pageDocumentLeft = 0;
    let pageDocumentTop = 0;
    let renderLeft = 0;
    let renderScale = 1;
    let geometryReady = false;
    let lastPointerMovement = 0;
    let latestClientX = -LENS_DIAMETER;
    let latestClientY = -LENS_DIAMETER;
    let toneRanges: ToneRange[] = [];
    let previousBaseClip = "";
    let previousMutedClip = "";

    function clearFadeTimer() {
      if (fadeTimer !== null) {
        window.clearTimeout(fadeTimer);
        fadeTimer = null;
      }
    }

    function hideLens() {
      lensElement.classList.remove("is-active");
    }

    function rebuildLayout() {
      const pageRect = pageElement.getBoundingClientRect();
      pageDocumentLeft = pageRect.left + window.scrollX;
      pageDocumentTop = pageRect.top + window.scrollY;

      const pageWidth = pageRect.width;
      const pageHeight = pageElement.offsetHeight;
      renderScale = Math.max(pageWidth / sourceWidth, pageHeight / sourceHeight);
      renderLeft = (pageWidth - sourceWidth * renderScale) / 2;
      geometryElement.setAttribute("x", String(renderLeft));
      geometryElement.setAttribute("y", "0");
      geometryElement.setAttribute("width", String(sourceWidth * renderScale));
      geometryElement.setAttribute("height", String(sourceHeight * renderScale));

      const mutedSections = Array.from(
        pageElement.querySelectorAll<HTMLElement>(":scope > section"),
      ).filter((section) => section.matches(MUTED_SECTION_SELECTOR));
      toneRanges = mutedSections.map((section) => {
        const sectionRect = section.getBoundingClientRect();

        return {
          top: sectionRect.top + window.scrollY - pageDocumentTop,
          bottom: sectionRect.bottom + window.scrollY - pageDocumentTop,
        };
      });
    }

    function scheduleLayoutRefresh() {
      if (layoutFrame !== null) return;
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = null;
        rebuildLayout();
      });
    }

    function updateToneClips(lensTop: number) {
      const overlaps = toneRanges
        .map((range) => ({
          top: Math.max(0, range.top - lensTop),
          bottom: Math.min(LENS_DIAMETER, range.bottom - lensTop),
        }))
        .filter((range) => range.bottom > range.top)
        .sort((first, second) => first.top - second.top);

      let cursor = 0;
      let basePath = "";
      let mutedPath = "";
      overlaps.forEach((range) => {
        if (range.top > cursor) basePath += rectPath(cursor, range.top);
        mutedPath += rectPath(range.top, range.bottom);
        cursor = Math.max(cursor, range.bottom);
      });
      if (cursor < LENS_DIAMETER) {
        basePath += rectPath(cursor, LENS_DIAMETER);
      }

      if (basePath !== previousBaseClip) {
        baseClipElement.setAttribute("d", basePath);
        previousBaseClip = basePath;
      }
      if (mutedPath !== previousMutedClip) {
        mutedClipElement.setAttribute("d", mutedPath);
        previousMutedClip = mutedPath;
      }
    }

    function paintPointer() {
      pointerFrame = null;
      const localX = latestClientX + window.scrollX - pageDocumentLeft;
      const localY = latestClientY + window.scrollY - pageDocumentTop;
      const lensLeft = localX - LENS_RADIUS;
      const lensTop = localY - LENS_RADIUS;

      lensElement.style.transform = `translate3d(${lensLeft}px, ${lensTop}px, 0)`;
      geometryTransformElement.setAttribute(
        "transform",
        `translate(${-lensLeft} ${-lensTop})`,
      );
      updateToneClips(lensTop);

      if (geometryReady) lensElement.classList.add("is-active");
    }

    function schedulePointerPaint() {
      if (pointerFrame === null) {
        pointerFrame = window.requestAnimationFrame(paintPointer);
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      latestClientX = event.clientX;
      latestClientY = event.clientY;
      lastPointerMovement = window.performance.now();
      schedulePointerPaint();

      if (fadeTimer === null) {
        fadeTimer = window.setTimeout(checkPointerIdle, 420);
      }
    }

    function checkPointerIdle() {
      fadeTimer = null;
      const remaining = 420 - (window.performance.now() - lastPointerMovement);
      if (remaining <= 0) {
        hideLens();
        return;
      }
      fadeTimer = window.setTimeout(checkPointerIdle, remaining);
    }

    function handlePointerLeave() {
      clearFadeTimer();
      hideLens();
    }

    function handleGeometryLoad() {
      geometryReady = true;
      if (latestClientX > -LENS_DIAMETER) schedulePointerPaint();
    }

    function handleGeometryError() {
      geometryReady = false;
      hideLens();
    }

    rebuildLayout();
    geometryElement.addEventListener("load", handleGeometryLoad);
    geometryElement.addEventListener("error", handleGeometryError);
    geometryElement.setAttribute("href", lensImageUrl);
    const resizeObserver = new ResizeObserver(scheduleLayoutRefresh);
    resizeObserver.observe(pageElement);
    window.addEventListener("resize", scheduleLayoutRefresh);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      clearFadeTimer();
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
      if (pointerFrame !== null) window.cancelAnimationFrame(pointerFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleLayoutRefresh);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      geometryElement.removeEventListener("load", handleGeometryLoad);
      geometryElement.removeEventListener("error", handleGeometryError);
      geometryElement.removeAttribute("href");
    };
  }, [lensImageUrl, sourceHeight, sourceWidth]);

  const circuitStyle = {
    "--public-circuit-image": `url("${imageUrl}")`,
  } as CSSProperties;

  return (
    <>
      <div
        ref={artRef}
        className="public-circuit-art"
        style={circuitStyle}
        aria-hidden="true"
      />
      <svg
        ref={lensRef}
        className="public-circuit-glow-lens"
        viewBox={`0 0 ${LENS_DIAMETER} ${LENS_DIAMETER}`}
        aria-hidden="true"
      >
        <defs>
          <radialGradient
            id={blueEnvelopeGradientId}
            gradientUnits="userSpaceOnUse"
            cx={LENS_RADIUS}
            cy={LENS_RADIUS}
            r={LENS_RADIUS}
          >
            <stop offset="0" stopColor="#fff" stopOpacity="0.96" />
            <stop offset="0.08" stopColor="#fff" stopOpacity="0.94" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.82" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.62" />
            <stop offset="0.68" stopColor="#fff" stopOpacity="0.38" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="0.9" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="0.96" stopColor="#fff" stopOpacity="0.01" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id={pinkEnvelopeGradientId}
            gradientUnits="userSpaceOnUse"
            cx={LENS_RADIUS}
            cy={LENS_RADIUS}
            r={LENS_RADIUS}
          >
            <stop offset="0" stopColor="#fff" stopOpacity="0.94" />
            <stop offset="0.08" stopColor="#fff" stopOpacity="0.92" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="0.68" stopColor="#fff" stopOpacity="0.37" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="0.19" />
            <stop offset="0.9" stopColor="#fff" stopOpacity="0.075" />
            <stop offset="0.96" stopColor="#fff" stopOpacity="0.01" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask
            id={blueEnvelopeMaskId}
            x="0"
            y="0"
            width={LENS_DIAMETER}
            height={LENS_DIAMETER}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            style={{ maskType: "alpha" }}
          >
            <rect
              width={LENS_DIAMETER}
              height={LENS_DIAMETER}
              fill={`url(#${blueEnvelopeGradientId})`}
            />
          </mask>
          <mask
            id={pinkEnvelopeMaskId}
            x="0"
            y="0"
            width={LENS_DIAMETER}
            height={LENS_DIAMETER}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            style={{ maskType: "alpha" }}
          >
            <rect
              width={LENS_DIAMETER}
              height={LENS_DIAMETER}
              fill={`url(#${pinkEnvelopeGradientId})`}
            />
          </mask>
          <mask
            id={geometryMaskId}
            x="0"
            y="0"
            width={LENS_DIAMETER}
            height={LENS_DIAMETER}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            style={{ maskType: "luminance" }}
          >
            <g ref={geometryTransformRef}>
              <image ref={geometryRef} preserveAspectRatio="none" />
            </g>
          </mask>
          <clipPath id={baseClipId}>
            <path ref={baseClipRef} />
          </clipPath>
          <clipPath id={mutedClipId}>
            <path ref={mutedClipRef} />
          </clipPath>
        </defs>
        <g
          clipPath={`url(#${baseClipId})`}
          mask={`url(#${blueEnvelopeMaskId})`}
        >
          <g
            style={{
              filter:
                "drop-shadow(0 0 4.25px rgb(0 124 255 / 0.95)) drop-shadow(0 0 4.25px rgb(0 124 255 / 0.95)) drop-shadow(0 0 4.25px rgb(0 124 255 / 0.95))",
            }}
          >
            <g mask={`url(#${geometryMaskId})`}>
              <rect
                width={LENS_DIAMETER}
                height={LENS_DIAMETER}
                fill="#edf9ff"
              />
            </g>
          </g>
        </g>
        <g
          clipPath={`url(#${mutedClipId})`}
          mask={`url(#${pinkEnvelopeMaskId})`}
        >
          <g
            style={{
              filter:
                "drop-shadow(0 0 4.25px rgb(223 58 148 / 0.95)) drop-shadow(0 0 4.25px rgb(223 58 148 / 0.95)) drop-shadow(0 0 4.25px rgb(223 58 148 / 0.95))",
            }}
          >
            <g mask={`url(#${geometryMaskId})`}>
              <rect
                width={LENS_DIAMETER}
                height={LENS_DIAMETER}
                fill="#fff0f8"
              />
            </g>
          </g>
        </g>
      </svg>
    </>
  );
}
