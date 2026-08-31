"use client";

import type { MouseEvent } from "react";
import { CircuitUnderlay } from "./CircuitUnderlay";

type CaseStudyBackLinkProps = {
  fallbackHref?: string;
};

export function CaseStudyBackLink({ fallbackHref = "/#work" }: CaseStudyBackLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    const hasPreviousPage = window.history.length > 1 && document.referrer.length > 0;

    if (hasPreviousPage) {
      window.history.back();
      return;
    }

    const currentUrl = window.location.href;
    const fallbackUrl = new URL(fallbackHref, currentUrl).href;
    const currentState = window.history.state;

    window.history.replaceState(currentState, "", fallbackUrl);
    window.history.pushState(currentState, "", currentUrl);
    window.addEventListener(
      "popstate",
      () => {
        window.location.reload();
      },
      { once: true },
    );
    window.history.back();
  };

  return (
    <a className="case-back-link reveal" href={fallbackHref} onClick={handleClick}>
      <span className="case-back-link-arrow" aria-hidden="true" />
      <CircuitUnderlay size="compact">Back to selected work</CircuitUnderlay>
    </a>
  );
}
