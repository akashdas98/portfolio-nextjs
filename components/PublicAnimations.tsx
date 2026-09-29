"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const revealSelector = ".reveal, .reveal-item";
const revealTriggerRatio = 0.94;
const pcbRevealFallbackMs = 8_000;
const countSelector = [
  "dt",
  ".case-outcome-table td",
  ".case-outcome-footer strong",
  ".case-system-card strong",
  ".service-number",
  ".principles > div > span",
].join(", ");

const numberPattern = /[-+]?\d[\d,]*(?:\.\d+)?/;

type ParsedNumber = {
  original: string;
  prefix: string;
  suffix: string;
  value: number;
  decimalPlaces: number;
  minimumIntegerDigits: number;
  useGrouping: boolean;
};

function parseNumber(text: string): ParsedNumber | null {
  const match = text.match(numberPattern);
  if (!match || match.index === undefined) return null;

  const numericText = match[0];
  const normalized = numericText.replace(/,/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  const integerPart = normalized.split(".")[0].replace(/^[+-]/, "");
  const decimalPart = normalized.split(".")[1] ?? "";

  return {
    original: text,
    prefix: text.slice(0, match.index),
    suffix: text.slice(match.index + numericText.length),
    value,
    decimalPlaces: decimalPart.length,
    minimumIntegerDigits: integerPart.startsWith("0") ? integerPart.length : 1,
    useGrouping: numericText.includes(","),
  };
}

function formatValue(value: number, parsed: ParsedNumber) {
  const fixedValue =
    parsed.decimalPlaces > 0
      ? value.toFixed(parsed.decimalPlaces)
      : Math.round(value).toString();
  const [integerPart, decimalPart] = fixedValue.split(".");
  const paddedInteger = integerPart.padStart(parsed.minimumIntegerDigits, "0");
  const groupedInteger = parsed.useGrouping
    ? Number(paddedInteger).toLocaleString("en-IN", {
        maximumFractionDigits: 0,
        minimumIntegerDigits: parsed.minimumIntegerDigits,
      })
    : paddedInteger;

  return `${parsed.prefix}${groupedInteger}${decimalPart ? `.${decimalPart}` : ""}${parsed.suffix}`;
}

function getPreviousNumber(element: Element) {
  const previous = element.previousElementSibling;
  if (!previous) return null;

  const parsed = parseNumber(previous.textContent?.trim() ?? "");
  return parsed?.value ?? null;
}

function resolveStartValue(element: Element, target: number) {
  if (element.classList.contains("case-table-after")) {
    const previousValue = getPreviousNumber(element);
    if (previousValue !== null && previousValue !== target) return previousValue;
  }

  return 0;
}

function animateNumber(element: Element) {
  if (element.getAttribute("data-counted") === "true") return;

  const parsed = parseNumber(element.textContent?.trim() ?? "");
  if (!parsed) return;
  const textTarget =
    element.querySelector(":scope .circuit-text-underlay-content") ?? element;

  element.setAttribute("data-counted", "true");

  const parsedNumber = parsed;
  const start = resolveStartValue(element, parsedNumber.value);
  const distance = parsedNumber.value - start;
  const duration = Math.min(1400, Math.max(760, 680 + Math.abs(distance) * 5));
  const startedAt = performance.now();

  function tick(now: number) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    textTarget.textContent = formatValue(start + distance * eased, parsedNumber);

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    textTarget.textContent = parsedNumber.original;
  }

  requestAnimationFrame(tick);
}

function createRevealAnimation(element: Element) {
  const animation = element.animate(
    [
      { opacity: 0, transform: "translateY(16px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    {
      duration: 520,
      easing: "cubic-bezier(0.2, 0.75, 0.2, 1)",
      fill: "both",
    },
  );

  animation.pause();
  animation.currentTime = 0;
  return animation;
}

export function PublicAnimations() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const publicMain = document.querySelector<HTMLElement>(
      "main[data-public-animations]",
    );
    if (!publicMain) return;
    const art = publicMain.querySelector<HTMLElement>(".public-circuit-art");

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      function releaseReducedMotionContent() {
        if (art?.getAttribute("data-viewport-state") === "pending") return;
        publicMain?.querySelectorAll(revealSelector).forEach((element) => {
          element.setAttribute("data-revealed", "true");
        });
        document.querySelectorAll(".site-header, .site-footer").forEach((element) => {
          element.setAttribute("data-pcb-entrance", "done");
        });
      }
      const observer = new MutationObserver(releaseReducedMotionContent);
      if (art) observer.observe(art, {
        attributes: true,
        attributeFilter: ["data-viewport-state"],
      });
      publicMain.addEventListener("pcb:viewport-ready", releaseReducedMotionContent);
      releaseReducedMotionContent();
      return () => {
        observer.disconnect();
        publicMain.removeEventListener("pcb:viewport-ready", releaseReducedMotionContent);
      };
    }

    const revealAnimations = new Set<Animation>();
    const preparedAnimations = new WeakMap<Element, Animation>();
    const revealFallbacks = new Map<Animation, number>();
    const initialRevealTargets = new Map<Element, number>();
    const queuedRevealTargets = new Set<Element>();
    const queuedCountTargets = new Set<Element>();
    let viewportFallback: number | undefined;
    const startupGateSupported = window.matchMedia("(scripting: enabled)").matches &&
      CSS.supports("selector(:has(*))");

    function viewportPending() {
      return art?.getAttribute("data-viewport-state") !== "failed" &&
        (art?.getAttribute("data-viewport-state") === "pending" ||
          art?.getAttribute("data-current-viewport-state") === "pending");
    }

    function releaseInitialTargets() {
      if (art?.getAttribute("data-viewport-state") === "pending") return;
      initialRevealTargets.forEach((deadline, element) => {
        if (element.getAttribute("data-reveal-initial") !== "pending") return;
        // A delayed CSS entrance may already have failed open. Never hide it
        // again if artwork finishes after that autonomous deadline.
        const stillWaiting = performance.now() < deadline;
        element.setAttribute("data-reveal-initial", stillWaiting ? "ready" : "done");
      });
      document.querySelectorAll(".site-header, .site-footer").forEach((element) => {
        element.setAttribute("data-pcb-entrance", "done");
      });
    }

    function flushViewportTargets(force = false) {
      if (!force && viewportPending()) return;
      if (viewportFallback !== undefined) window.clearTimeout(viewportFallback);
      viewportFallback = undefined;
      [...queuedRevealTargets].sort((first, second) =>
        first.getBoundingClientRect().top - second.getBoundingClientRect().top,
      ).forEach((element, index) => {
        playRevealTarget(element, index * 70);
        revealObserver.unobserve(element);
      });
      queuedRevealTargets.clear();
      queuedCountTargets.forEach((element) => {
        animateNumber(element);
        countObserver.unobserve(element);
      });
      queuedCountTargets.clear();
    }

    function awaitViewport() {
      if (viewportFallback !== undefined) return;
      viewportFallback = window.setTimeout(() => flushViewportTargets(true), pcbRevealFallbackMs);
    }

    function onViewportReady() {
      releaseInitialTargets();
      flushViewportTargets();
    }

    function finishReveal(element: Element, animation: Animation) {
      if (preparedAnimations.get(element) !== animation) return;

      const fallback = revealFallbacks.get(animation);
      if (fallback !== undefined) window.clearTimeout(fallback);

      revealFallbacks.delete(animation);
      preparedAnimations.delete(element);
      revealAnimations.delete(animation);
      animation.cancel();
    }

    function prepareRevealTarget(element: Element) {
      if (
        element.getAttribute("data-revealed") === "true" ||
        preparedAnimations.has(element)
      ) {
        return;
      }

      element.getAnimations().forEach((animation) => animation.cancel());
      const animation = createRevealAnimation(element);
      preparedAnimations.set(element, animation);
      revealAnimations.add(animation);
    }

    function playRevealTarget(element: Element, delay: number) {
      if (element.getAttribute("data-revealed") === "true") return;

      let animation = preparedAnimations.get(element);
      if (!animation) {
        animation = createRevealAnimation(element);
        preparedAnimations.set(element, animation);
        revealAnimations.add(animation);
      }

      element.setAttribute("data-revealed", "true");
      animation.effect?.updateTiming({ delay });
      animation.play();

      const activeAnimation = animation;
      revealFallbacks.set(
        activeAnimation,
        window.setTimeout(
          () => finishReveal(element, activeAnimation),
          delay + 850,
        ),
      );
      activeAnimation.finished.then(
        () => finishReveal(element, activeAnimation),
        () => undefined,
      );
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              first.target.getBoundingClientRect().top -
              second.target.getBoundingClientRect().top,
          );

        entries.filter((entry) => !entry.isIntersecting).forEach((entry) => {
          queuedRevealTargets.delete(entry.target);
        });
        entering.forEach((entry, index) => {
          if (viewportPending()) {
            queuedRevealTargets.add(entry.target);
            awaitViewport();
            return;
          }
          playRevealTarget(entry.target, index * 70);
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0 },
    );

    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (viewportPending()) {
              queuedCountTargets.add(entry.target);
              awaitViewport();
              return;
            }
            animateNumber(entry.target);
            countObserver.unobserve(entry.target);
          } else {
            queuedCountTargets.delete(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.01 },
    );

    const observedRevealTargets = new WeakSet<Element>();
    const observedCountTargets = new WeakSet<Element>();

    function registerRevealTarget(element: Element, startsBeyondRevealLine: boolean) {
      if (element.getAttribute("data-revealed") === "true" &&
        element.getAttribute("data-reveal-initial") !== "pending") return;
      if (!startsBeyondRevealLine) {
        if (startupGateSupported && art?.getAttribute("data-viewport-state") === "pending") {
          const waitingAnimation = element.getAnimations().find((animation) =>
            Number(animation.effect?.getTiming().delay ?? 0) >= pcbRevealFallbackMs,
          );
          const remaining = waitingAnimation
            ? Number(waitingAnimation.effect?.getTiming().delay ?? 0) -
              Number(waitingAnimation.currentTime ?? 0)
            : 0;
          if (remaining > 0) {
            element.setAttribute("data-reveal-initial", "pending");
            initialRevealTargets.set(element, performance.now() + remaining);
          }
        }
        element.setAttribute("data-revealed", "true");
        return;
      }

      element.setAttribute("data-reveal-scroll", "true");
      prepareRevealTarget(element);
      revealObserver.observe(element);
    }

    function registerCountTarget(element: Element, startsBeyondRevealLine: boolean) {
      if (!startsBeyondRevealLine) {
        element.setAttribute("data-counted", "true");
        return;
      }

      countObserver.observe(element);
    }

    function registerTrees(nodes: Iterable<Node>) {
      const revealTargets: Element[] = [];
      const countTargets: Element[] = [];

      for (const node of nodes) {
        if (!(node instanceof Element)) continue;

        const revealCandidates = [
          ...(node.matches(revealSelector) ? [node] : []),
          ...node.querySelectorAll(revealSelector),
        ];
        revealCandidates.forEach((element) => {
          if (observedRevealTargets.has(element)) return;
          observedRevealTargets.add(element);
          revealTargets.push(element);
        });

        const countCandidates = [
          ...(node.matches(countSelector) ? [node] : []),
          ...node.querySelectorAll(countSelector),
        ];
        countCandidates.forEach((element) => {
          if (
            observedCountTargets.has(element) ||
            !parseNumber(element.textContent?.trim() ?? "")
          ) {
            return;
          }
          observedCountTargets.add(element);
          countTargets.push(element);
        });
      }

      const revealLine = window.innerHeight * revealTriggerRatio;
      const revealRegistrations = revealTargets.map((element) => ({
        element,
        startsBeyondRevealLine: element.getBoundingClientRect().top > revealLine,
      }));
      const countRegistrations = countTargets.map((element) => ({
        element,
        startsBeyondRevealLine: element.getBoundingClientRect().top > revealLine,
      }));

      revealRegistrations.forEach(({ element, startsBeyondRevealLine }) =>
        registerRevealTarget(element, startsBeyondRevealLine),
      );
      countRegistrations.forEach(({ element, startsBeyondRevealLine }) =>
        registerCountTarget(element, startsBeyondRevealLine),
      );
    }

    registerTrees([publicMain]);
    publicMain.addEventListener("pcb:viewport-ready", onViewportReady);
    const readinessObserver = new MutationObserver(onViewportReady);
    if (art) readinessObserver.observe(art, {
      attributes: true,
      attributeFilter: ["data-viewport-state", "data-current-viewport-state"],
    });

    const mutationObserver = new MutationObserver((records) => {
      registerTrees(records.flatMap((record) => Array.from(record.addedNodes)));
    });
    mutationObserver.observe(publicMain, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      readinessObserver.disconnect();
      publicMain.removeEventListener("pcb:viewport-ready", onViewportReady);
      if (viewportFallback !== undefined) window.clearTimeout(viewportFallback);
      revealObserver.disconnect();
      countObserver.disconnect();
      revealFallbacks.forEach((fallback) => window.clearTimeout(fallback));
      revealFallbacks.clear();
      revealAnimations.forEach((animation) => animation.cancel());
      revealAnimations.clear();
    };
  }, [pathname]);

  return null;
}
