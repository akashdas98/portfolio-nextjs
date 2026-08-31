"use client";

import { Fragment, useCallback, useSyncExternalStore } from "react";

import type { LeadNetworkHeroVisualDocument } from "@/lib/case-study/schema";
import { CircuitUnderlay } from "./CircuitUnderlay";

type LeadNetworkDiagramProps = {
  visual: LeadNetworkHeroVisualDocument;
};

type LeadNetworkVariant = "wide" | "tablet" | "mobile" | "compact";

function useLeadNetworkVariant(visual: LeadNetworkHeroVisualDocument): LeadNetworkVariant {
  const { compactMax, mobileMax, tabletMax } = visual.layout.breakpoints;
  const compactQuery = `(max-width: ${compactMax}px)`;
  const mobileQuery = `(min-width: ${compactMax + 1}px) and (max-width: ${mobileMax}px)`;
  const tabletQuery = `(min-width: ${mobileMax + 1}px) and (max-width: ${tabletMax}px)`;

  const getSnapshot = useCallback((): LeadNetworkVariant => {
    if (window.matchMedia(compactQuery).matches) return "compact";
    if (window.matchMedia(mobileQuery).matches) return "mobile";
    if (window.matchMedia(tabletQuery).matches) return "tablet";
    return "wide";
  }, [compactQuery, mobileQuery, tabletQuery]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const queries = [compactQuery, mobileQuery, tabletQuery].map((query) =>
        window.matchMedia(query),
      );
      queries.forEach((query) => query.addEventListener("change", onChange));
      return () => queries.forEach((query) => query.removeEventListener("change", onChange));
    },
    [compactQuery, mobileQuery, tabletQuery],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => "mobile");
}

export function LeadNetworkDiagram({ visual }: LeadNetworkDiagramProps) {
  const variant = useLeadNetworkVariant(visual);

  return (
    <figure className="case-diagram case-lead-network reveal">
      <p className="eyebrow case-lead-network-eyebrow"><CircuitUnderlay size="compact">{visual.eyebrow}</CircuitUnderlay></p>

      {variant === "wide" || variant === "tablet" ? (
        <WideLeadNetwork visual={visual} tablet={variant === "tablet"} />
      ) : (
        <MobileLeadNetwork visual={visual} compact={variant === "compact"} />
      )}

      <figcaption className="case-diagram-caption">
        <p>
          <span className="case-diagram-caption-marker" aria-hidden="true" />
          <CircuitUnderlay size="compact">{visual.title}</CircuitUnderlay>
        </p>
      </figcaption>
    </figure>
  );
}

function WideLeadNetwork({
  visual,
  tablet,
}: LeadNetworkDiagramProps & { tablet: boolean }) {
  const variant = tablet ? "tablet" : "wide";
  const titleId = `lead-network-title-${variant}`;
  const descriptionId = `lead-network-description-${variant}`;
  const { canvas, wide } = visual.layout;
  const frameSize = {
    width: canvas.width - canvas.frameInset * 2,
    height: canvas.height - canvas.frameInset * 2,
  };

  return (
    <div
      className={`lead-network-variant lead-network-${variant}`}
      data-diagram-variant={`lead-${variant}`}
    >
      <svg
        className="case-diagram-surface lead-network-svg"
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>{visual.title}</title>
        <desc id={descriptionId}>{visual.description}</desc>
        <defs>
          <pattern
            id={`lead-grid-${variant}`}
            width={canvas.gridSize}
            height={canvas.gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M${canvas.gridSize} 0H0V${canvas.gridSize}`}
              fill="none"
              stroke="rgba(220, 235, 244, 0.12)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
          <marker
            id={`lead-arrow-${variant}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path
              d="M1.5 1.5L8 5L1.5 8.5"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
            />
          </marker>
        </defs>

        <rect
          className="case-diagram-surface"
          x={canvas.frameInset}
          y={canvas.frameInset}
          width={frameSize.width}
          height={frameSize.height}
          stroke="var(--line-strong)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={canvas.frameInset}
          y={canvas.frameInset}
          width={frameSize.width}
          height={frameSize.height}
          fill={`url(#lead-grid-${variant})`}
          opacity="0.38"
        />
        <path
          d={wide.sourceConnectorPath}
          fill="none"
          stroke="rgba(158, 216, 242, 0.74)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          markerEnd={`url(#lead-arrow-${variant})`}
        />
        <path
          d={wide.destinationConnectorPath}
          fill="none"
          stroke="rgba(158, 216, 242, 0.74)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          markerEnd={`url(#lead-arrow-${variant})`}
        />

        <text
          x={wide.sourceX}
          y={wide.titleY}
          className="lead-network-svg-lane-label"
          fill="var(--accent)"
        >
          {visual.sourceLabel}
        </text>
        <text x={wide.sourceX} y={wide.statY} className="lead-network-svg-stat" fill="var(--text)">
          {visual.sourceStat}
        </text>
        <text
          x={wide.sourceX + wide.laneWidth}
          y={wide.statY}
          textAnchor="end"
          className="lead-network-svg-meta"
          fill="var(--subtle)"
        >
          {visual.sourceStatLabel}
        </text>
        <line
          x1={wide.sourceX}
          y1={wide.sourceRuleY}
          x2={wide.sourceX + wide.laneWidth}
          y2={wide.sourceRuleY}
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        <text
          x={wide.destinationX}
          y={wide.titleY}
          className="lead-network-svg-lane-label"
          fill="var(--accent)"
        >
          {visual.destinationLabel}
        </text>
        <line
          x1={wide.destinationX}
          y1={wide.destinationRuleY}
          x2={wide.destinationX + wide.laneWidth}
          y2={wide.destinationRuleY}
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {visual.sources.map((source, index) => (
          <LeadNetworkSvgNode
            key={source.key}
            node={source}
            x={wide.sourceX}
            y={wide.nodeStartY + index * wide.nodeGap}
            width={wide.nodeWidth}
            height={wide.nodeHeight}
            textX={wide.nodeTextX}
            titleY={wide.nodeTitleY}
            detailY={wide.nodeDetailY}
            accentStartX={wide.nodeAccentStartX}
            accentEndX={wide.nodeAccentEndX}
          />
        ))}

        {visual.destinations.map((destination, index) => (
          <LeadNetworkSvgNode
            key={destination.key}
            node={destination}
            x={wide.destinationX}
            y={wide.nodeStartY + index * wide.nodeGap}
            width={wide.nodeWidth}
            height={wide.nodeHeight}
            textX={wide.nodeTextX}
            titleY={wide.nodeTitleY}
            detailY={wide.nodeDetailY}
            accentStartX={wide.nodeAccentStartX}
            accentEndX={wide.nodeAccentEndX}
            destination
          />
        ))}

        <foreignObject
          x={wide.core.x}
          y={wide.core.y}
          width={wide.core.width}
          height={wide.core.height}
        >
          <LeadServiceCore visual={visual} />
        </foreignObject>

      </svg>
    </div>
  );
}

function LeadNetworkSvgNode({
  node,
  x,
  y,
  width,
  height,
  textX,
  titleY,
  detailY,
  accentStartX,
  accentEndX,
  destination = false,
}: {
  node: LeadNetworkHeroVisualDocument["sources"][number];
  x: number;
  y: number;
  width: number;
  height: number;
  textX: number;
  titleY: number;
  detailY: number;
  accentStartX: number;
  accentEndX: number;
  destination?: boolean;
}) {
  return (
    <Fragment>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={destination ? "rgba(18, 28, 34, 0.98)" : "rgba(15, 19, 23, 0.98)"}
        stroke={destination ? "rgba(158, 216, 242, 0.42)" : "var(--line-strong)"}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={x + accentStartX}
        y1={y + 1}
        x2={x + accentEndX}
        y2={y + 1}
        stroke="var(--accent)"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={x + textX}
        y={y + titleY}
        className="lead-network-svg-node-title"
        fill="var(--text)"
      >
        {node.name}
      </text>
      <text
        x={x + textX}
        y={y + detailY}
        className="lead-network-svg-node-detail"
        fill="var(--subtle)"
      >
        {node.role}
      </text>
    </Fragment>
  );
}

function MobileLeadNetwork({
  visual,
  compact,
}: LeadNetworkDiagramProps & { compact: boolean }) {
  return (
    <div
      className={`case-diagram-surface lead-network-canvas is-mobile${compact ? " is-compact" : ""}`}
      data-diagram-variant={compact ? "lead-compact" : "lead-mobile"}
      role="img"
      aria-label={`${visual.title} ${visual.description}`}
    >
      <div className="lead-network-mobile-group" aria-hidden="true">
        <div className="lead-network-lane-heading">
          <span>{visual.sourceLabel}</span>
          <strong>{visual.sourceStat}</strong>
          <small>{visual.sourceStatLabel}</small>
        </div>
        <div className="lead-network-mobile-nodes">
          {visual.sources.map((source) => (
            <LeadNetworkNode key={source.key} node={source} />
          ))}
        </div>
      </div>

      <LeadNetworkConnector direction="down" />
      <LeadServiceCore visual={visual} />
      <LeadNetworkConnector direction="down" />

      <div className="lead-network-mobile-group is-destination" aria-hidden="true">
        <div className="lead-network-lane-heading">
          <span>{visual.destinationLabel}</span>
        </div>
        <div className="lead-network-mobile-nodes">
          {visual.destinations.map((destination) => (
            <LeadNetworkNode key={destination.key} node={destination} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LeadServiceCore({ visual }: LeadNetworkDiagramProps) {
  return (
    <div className="lead-network-core" aria-hidden="true">
      <header>
        <span>{visual.serviceRole}</span>
        <strong>{visual.serviceLabel}</strong>
      </header>
      <ol className="lead-network-stage-list">
        {visual.stages.map((stage) => (
          <li key={stage.number}>
            <span>{stage.number}</span>
            <div>
              <strong>{stage.title}</strong>
              <small>{stage.detail}</small>
            </div>
          </li>
        ))}
      </ol>
      <div className="lead-network-record">
        <span>{visual.record.role}</span>
        <strong>{visual.record.name}</strong>
        <small>{visual.record.detail}</small>
      </div>
    </div>
  );
}

function LeadNetworkNode({
  node,
}: {
  node: LeadNetworkHeroVisualDocument["sources"][number];
}) {
  return (
    <article className="lead-network-node">
      <span aria-hidden="true" />
      <strong>{node.name}</strong>
      <small>{node.role}</small>
    </article>
  );
}

function LeadNetworkConnector({ direction }: { direction: "right" | "down" }) {
  return <span className={`lead-network-connector is-${direction}`} aria-hidden="true" />;
}
