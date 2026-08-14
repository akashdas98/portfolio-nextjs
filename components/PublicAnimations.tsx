"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const revealSelector = ".reveal, .reveal-item";
const revealTriggerRatio = 0.94;
const countSelector = [
  "dt",
  ".case-outcome-table td",
  ".case-outcome-footer strong",
  ".case-system-card strong",
  ".service-number",
  ".principles span",
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

  element.setAttribute("data-counted", "true");

  const parsedNumber = parsed;
  const start = resolveStartValue(element, parsedNumber.value);
  const distance = parsedNumber.value - start;
  const duration = Math.min(1400, Math.max(760, 680 + Math.abs(distance) * 5));
  const startedAt = performance.now();

  function tick(now: number) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatValue(start + distance * eased, parsedNumber);

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    element.textContent = parsedNumber.original;
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

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const revealAnimations = new Set<Animation>();
    const preparedAnimations = new WeakMap<Element, Animation>();
    const preparedTargets = new Set<Element>();
    const revealFallbacks = new Map<Animation, number>();

    function finishReveal(element: Element, animation: Animation) {
      if (preparedAnimations.get(element) !== animation) return;

      const fallback = revealFallbacks.get(animation);
      if (fallback !== undefined) window.clearTimeout(fallback);

      revealFallbacks.delete(animation);
      preparedAnimations.delete(element);
      preparedTargets.delete(element);
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
      preparedTargets.add(element);
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
      preparedTargets.delete(element);
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

        entering.forEach((entry, index) => {
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
            animateNumber(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.01 },
    );

    const observedRevealTargets = new WeakSet<Element>();
    const observedCountTargets = new WeakSet<Element>();

    function startsBeyondRevealLine(element: Element) {
      return element.getBoundingClientRect().top > window.innerHeight * revealTriggerRatio;
    }

    function registerRevealTarget(element: Element) {
      if (observedRevealTargets.has(element)) return;
      observedRevealTargets.add(element);

      if (!startsBeyondRevealLine(element)) {
        element.setAttribute("data-revealed", "true");
        return;
      }

      prepareRevealTarget(element);
      revealObserver.observe(element);
    }

    function registerCountTarget(element: Element) {
      if (observedCountTargets.has(element)) return;
      if (parseNumber(element.textContent?.trim() ?? "")) {
        observedCountTargets.add(element);

        if (!startsBeyondRevealLine(element)) {
          element.setAttribute("data-counted", "true");
          return;
        }

        countObserver.observe(element);
      }
    }

    function registerTree(node: Node) {
      if (!(node instanceof Element)) return;

      if (node.matches(revealSelector)) registerRevealTarget(node);
      node.querySelectorAll(revealSelector).forEach(registerRevealTarget);

      if (node.matches(countSelector)) registerCountTarget(node);
      node.querySelectorAll(countSelector).forEach(registerCountTarget);
    }

    registerTree(publicMain);

    const mutationObserver = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(registerTree));
    });
    mutationObserver.observe(publicMain, { childList: true, subtree: true });

    let scrollFrame = 0;
    function checkPreparedTargets() {
      scrollFrame = 0;
      const triggerLine = window.innerHeight * revealTriggerRatio;
      const entering = Array.from(preparedTargets)
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top <= triggerLine && bounds.bottom >= 0;
        })
        .sort(
          (first, second) =>
            first.getBoundingClientRect().top -
            second.getBoundingClientRect().top,
        );

      entering.forEach((element, index) => {
        playRevealTarget(element, index * 70);
        revealObserver.unobserve(element);
      });
    }

    function schedulePreparedCheck() {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(checkPreparedTargets);
    }

    window.addEventListener("scroll", schedulePreparedCheck, { passive: true });
    window.addEventListener("resize", schedulePreparedCheck);

    return () => {
      window.removeEventListener("scroll", schedulePreparedCheck);
      window.removeEventListener("resize", schedulePreparedCheck);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      mutationObserver.disconnect();
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
