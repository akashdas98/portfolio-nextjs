"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { HorecahFeatureHeroVisualDocument } from "@/lib/case-study/schema";

type CrossPlatformFeatureDiagramProps = {
  visual: HorecahFeatureHeroVisualDocument;
};

type CrossPlatformDiagramVariant = "wide" | "full-core" | "stacked";

function useCrossPlatformDiagramVariant(
  visual: HorecahFeatureHeroVisualDocument,
): CrossPlatformDiagramVariant {
  const { stackMax, fullCoreMax } = visual.layout.breakpoints;
  const stackQuery = `(max-width: ${stackMax}px)`;
  const fullCoreQuery = `(min-width: ${stackMax + 1}px) and (max-width: ${fullCoreMax}px)`;

  const getSnapshot = useCallback((): CrossPlatformDiagramVariant => {
    if (window.matchMedia(stackQuery).matches) return "stacked";
    if (window.matchMedia(fullCoreQuery).matches) return "full-core";
    return "wide";
  }, [fullCoreQuery, stackQuery]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const queries = [stackQuery, fullCoreQuery].map((query) => window.matchMedia(query));
      queries.forEach((query) => query.addEventListener("change", onChange));
      return () => queries.forEach((query) => query.removeEventListener("change", onChange));
    },
    [fullCoreQuery, stackQuery],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => "stacked");
}

export function CrossPlatformFeatureDiagram({ visual }: CrossPlatformFeatureDiagramProps) {
  const variant = useCrossPlatformDiagramVariant(visual);

  return (
    <figure className="case-diagram case-cross-platform-diagram reveal">
      <p className="eyebrow case-cross-platform-diagram-eyebrow">{visual.eyebrow}</p>

      <div
        className={`case-diagram-surface cross-platform-diagram-canvas is-${variant}`}
        data-diagram-variant={`cross-platform-${variant}`}
        role="img"
        aria-label={`${visual.title} ${visual.description}`}
      >
        <div className="cross-platform-diagram-platforms" aria-hidden="true">
          {visual.platforms.map((platform) => (
            <div className="cross-platform-diagram-platform" key={platform}>
              <span />
              <strong>{platform}</strong>
            </div>
          ))}
        </div>

        <span className="cross-platform-diagram-connector is-down" aria-hidden="true" />

        <div className="cross-platform-diagram-core" aria-hidden="true">
          <span>Shared client</span>
          <strong>{visual.sharedCore.name}</strong>
          <small>{visual.sharedCore.role}</small>
        </div>

        <div className="cross-platform-diagram-branch" aria-hidden="true">
          <span />
          <span />
        </div>

        <div className="cross-platform-diagram-features" aria-hidden="true">
          {visual.features.map((feature, featureIndex) => (
            <article className={`cross-platform-diagram-feature is-${feature.key}`} key={feature.key}>
              <header>
                <span>{String(featureIndex + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{feature.name}</strong>
                  <small>{feature.role}</small>
                </div>
              </header>
              <ol>
                {feature.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </div>

      <figcaption className="case-diagram-caption">
        <p>
          <span className="case-diagram-caption-marker" aria-hidden="true" />
          {visual.title}
        </p>
      </figcaption>
    </figure>
  );
}
