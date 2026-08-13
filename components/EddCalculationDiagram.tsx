"use client";

import { Fragment, useCallback, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

import type { EddHeroVisualDocument } from "@/lib/case-study/schema";

type EddCalculationDiagramProps = {
  visual: EddHeroVisualDocument;
};

type DiagramVariant = "desktop" | "tablet" | "mobile" | "mobile-compact";

function useDiagramVariant(visual: EddHeroVisualDocument): DiagramVariant {
  const { compactMax, mobileMax, tabletMax } = visual.layout.breakpoints;
  const compactQuery = `(max-width: ${compactMax}px)`;
  const mobileQuery = `(min-width: ${compactMax + 1}px) and (max-width: ${mobileMax}px)`;
  const tabletQuery = `(min-width: ${mobileMax + 1}px) and (max-width: ${tabletMax}px)`;

  const getSnapshot = useCallback((): DiagramVariant => {
    if (window.matchMedia(compactQuery).matches) return "mobile-compact";
    if (window.matchMedia(mobileQuery).matches) return "mobile";
    if (window.matchMedia(tabletQuery).matches) return "tablet";
    return "desktop";
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

export function EddCalculationDiagram({ visual }: EddCalculationDiagramProps) {
  const variant = useDiagramVariant(visual);

  return (
    <figure className="case-diagram case-edd-diagram reveal">
      <p className="eyebrow case-edd-diagram-eyebrow">{visual.eyebrow}</p>

      {variant === "desktop" ? <DesktopDiagram visual={visual} variant="desktop" /> : null}
      {variant === "tablet" ? <DesktopDiagram visual={visual} variant="tablet" /> : null}
      {variant === "mobile" || variant === "mobile-compact" ? (
        <MobileDiagram visual={visual} compact={variant === "mobile-compact"} />
      ) : null}

      <figcaption className="case-diagram-caption">
        <p>
          <span className="case-diagram-caption-marker" aria-hidden="true" />
          {visual.title}
        </p>
      </figcaption>
    </figure>
  );
}

function MobileDiagram({
  visual,
  compact,
}: {
  visual: EddHeroVisualDocument;
  compact: boolean;
}) {
  const layout = visual.layout.mobile;
  const integrationConnections = layout.connections.filter(
    (connection) => connection.to === "engine" && findIntegration(visual, connection.from),
  );
  const requestConnection = layout.connections.find(
    (connection) => connection.from === "request" && connection.to === "engine",
  );
  const responseConnection = layout.connections.find(
    (connection) => connection.from === "engine" && connection.to === "response",
  );
  const mobileStyle = {
    "--edd-mobile-canvas-padding": `${compact ? layout.compactCanvasPadding : layout.canvasPadding}px`,
    "--edd-mobile-grid-size": `${visual.layout.canvas.gridSize}px`,
    "--edd-mobile-endpoint-padding": `${compact ? layout.compactEndpointPadding : layout.endpointPadding}px`,
    "--edd-mobile-engine-padding": `${compact ? layout.compactEnginePadding : layout.enginePadding}px`,
    "--edd-mobile-entry-columns": layout.entryColumns.map((column) => `${column}%`).join(" "),
    "--edd-mobile-entry-padding-top": `${layout.entryPaddingTop}px`,
    "--edd-mobile-entry-padding-bottom": `${layout.entryPaddingBottom}px`,
    "--edd-mobile-integration-padding": `${compact ? layout.compactIntegrationPadding : layout.integrationPadding}px`,
    "--edd-mobile-integration-connector-height": `${layout.integrationConnectorHeight}px`,
    "--edd-mobile-integration-connector-gap": `${layout.integrationConnectorGap}px`,
    "--edd-mobile-response-connector-height": `${layout.responseConnectorHeight}px`,
    "--edd-mobile-stage-gap": `${layout.stageGap}px`,
    "--edd-mobile-stage-padding": `${compact ? layout.compactStagePadding : layout.stagePadding}px`,
    "--edd-mobile-compact-stage-header-padding": `${layout.compactStageHeaderPadding}px`,
    "--edd-mobile-compact-field-columns": `minmax(${layout.compactFieldRows.labelMinWidth}px, ${layout.compactFieldRows.labelFraction}fr) minmax(0, ${layout.compactFieldRows.valueFraction}fr)`,
    "--edd-mobile-compact-field-gap": `${layout.compactFieldRows.gap}px`,
    "--edd-mobile-compact-field-padding": `${layout.compactFieldRows.paddingBlock}px`,
    "--edd-mobile-stage-columns": compact
      ? "1fr"
      : `minmax(${layout.stageColumns.titleMinWidth}px, ${layout.stageColumns.titleFraction}fr) minmax(0, ${layout.stageColumns.detailsFraction}fr)`,
    "--edd-mobile-stage-column-gap": `${compact ? layout.stageColumns.compactGap : layout.stageColumns.gap}px`,
  } as CSSProperties;

  return (
    <div
      className={`case-diagram-surface edd-mobile-diagram${compact ? " is-compact" : ""}`}
      data-diagram-variant="mobile"
      role="img"
      aria-label={visual.title}
      style={mobileStyle}
    >
      <MobileEndpoint kind="request" label={visual.requestLabel} fields={visual.requestFields} />
      <div className="edd-mobile-entry">
        {requestConnection ? <span className="edd-mobile-entry-spine" aria-hidden="true" /> : null}
        {layout.integrationPositions.map((position) => {
          const integration = findIntegration(visual, position.integrationKey);
          const connection = integrationConnections.find(
            (item) => item.from === position.integrationKey,
          );
          return integration ? (
            <article
              className="edd-mobile-integration"
              key={integration.key}
              style={{ gridColumn: position.column }}
            >
              <strong>{integration.name}</strong>
              <span>{integration.role}</span>
              {connection ? <i aria-hidden="true" /> : null}
            </article>
          ) : null;
        })}
      </div>

      <section className="edd-mobile-engine">
        <p className="edd-mobile-group-label">{layout.groupLabel}</p>
        <ol className="edd-mobile-stage-list">
          {visual.stages.map((stage) => (
            <li className="edd-mobile-stage" key={stage.number}>
              <header>
                <span>{stage.number}</span>
                <h3>{stage.title}</h3>
              </header>
              <ul>
                {stage.items.map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      {responseConnection ? <MobileConnector accent={responseConnection.kind === "api"} /> : null}
      <MobileEndpoint
        kind="response"
        label={visual.responseLabel}
        fields={visual.responseFields}
      />
    </div>
  );
}

function MobileEndpoint({
  kind,
  label,
  fields,
}: {
  kind: "request" | "response";
  label: string;
  fields: EddHeroVisualDocument["requestFields"];
}) {
  return (
    <section className={`edd-mobile-endpoint is-${kind}`}>
      <header>
        <span>{kind === "request" ? "IN" : "OUT"}</span>
        <strong>{label}</strong>
      </header>
      <dl>
        {fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MobileConnector({ accent = false }: { accent?: boolean }) {
  return (
    <span
      className={`edd-mobile-connector${accent ? " is-accent" : ""}`}
      aria-hidden="true"
    />
  );
}

function DesktopDiagram({
  visual,
  variant,
}: {
  visual: EddHeroVisualDocument;
  variant: "desktop" | "tablet";
}) {
  const layout = visual.layout[variant];
  const { canvas } = visual.layout;
  const titleId = `edd-diagram-title-${variant}`;
  const descriptionId = `edd-diagram-description-${variant}`;
  const frameWidth = canvas.width - canvas.frameInset * 2;
  const frameHeight = canvas.height - canvas.frameInset * 2;

  return (
    <div className={`edd-diagram-variant edd-diagram-${variant}`} data-diagram-variant={variant}>
      <svg
        className="case-diagram-surface edd-diagram-svg"
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
      <title id={titleId}>{visual.title}</title>
      <desc id={descriptionId}>{visual.description}</desc>
      <DiagramDefinitions suffix={variant} gridSize={canvas.gridSize} />
      <rect
        className="case-diagram-surface edd-diagram-canvas"
        x={canvas.frameInset}
        y={canvas.frameInset}
        width={frameWidth}
        height={frameHeight}
      />
      <rect
        className="edd-diagram-grid"
        x={canvas.frameInset}
        y={canvas.frameInset}
        width={frameWidth}
        height={frameHeight}
        fill={`url(#edd-grid-${variant})`}
      />
      <rect
        className="edd-diagram-server-boundary"
        x={layout.boundary.x}
        y={layout.boundary.y}
        width={layout.boundary.width}
        height={layout.boundary.height}
      />

      {layout.flowPaths.map((path) => (
        <path
          key={path}
          className="edd-diagram-flow"
          d={path}
          markerEnd={`url(#edd-arrow-${variant})`}
        />
      ))}

      {layout.services.map((service) => {
        const integration = findIntegration(visual, service.integrationKey);
        return integration ? (
          <Fragment key={integration.key}>
            <path
              className="edd-diagram-api-flow"
              d={service.path}
              markerStart={`url(#edd-api-arrow-${variant})`}
            />
            <DiagramServiceSvg
              integration={integration}
              x={service.x}
              y={service.y}
              width={service.width}
              height={service.height}
              tablet={variant === "tablet"}
            />
          </Fragment>
        ) : null;
      })}

      <foreignObject
        x={layout.request.x}
        y={layout.request.y}
        width={layout.request.width}
        height={layout.request.height}
      >
        <DiagramEndpoint
          kind="request"
          label={visual.requestLabel}
          fields={visual.requestFields}
          tablet={variant === "tablet"}
        />
      </foreignObject>

      {visual.stages.map((stage, index) => (
        <foreignObject
          key={stage.number}
          x={layout.stagePositions[index].x}
          y={layout.stagePositions[index].y}
          width={layout.stageSize.width}
          height={layout.stageSize.height}
        >
          <DiagramStage stage={stage} tablet={variant === "tablet"} />
        </foreignObject>
      ))}

      <foreignObject
        x={layout.response.x}
        y={layout.response.y}
        width={layout.response.width}
        height={layout.response.height}
      >
        <DiagramEndpoint
          kind="response"
          label={visual.responseLabel}
          fields={visual.responseFields}
          tablet={variant === "tablet"}
        />
      </foreignObject>
      </svg>
    </div>
  );
}

function DiagramDefinitions({
  suffix,
  gridSize,
}: {
  suffix: "desktop" | "tablet" | "mobile";
  gridSize: number;
}) {
  return (
    <defs>
      <pattern
        id={`edd-grid-${suffix}`}
        width={gridSize}
        height={gridSize}
        patternUnits="userSpaceOnUse"
      >
        <path d={`M${gridSize} 0H0V${gridSize}`} fill="none" />
      </pattern>
      <marker
        id={`edd-arrow-${suffix}`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="8"
        markerHeight="8"
        markerUnits="userSpaceOnUse"
        orient="auto"
      >
        <path d="M1.5 1.5L8 5L1.5 8.5" className="edd-diagram-arrowhead" />
      </marker>
      <marker
        id={`edd-api-arrow-${suffix}`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="9"
        markerHeight="9"
        markerUnits="userSpaceOnUse"
        orient="auto-start-reverse"
      >
        <path d="M1.5 1.5L8 5L1.5 8.5" className="edd-diagram-api-arrowhead" />
      </marker>
    </defs>
  );
}

function DiagramEndpoint({
  kind,
  label,
  fields,
  tablet = false,
}: {
  kind: "request" | "response";
  label: string;
  fields: EddHeroVisualDocument["requestFields"];
  tablet?: boolean;
}) {
  return (
    <div className={`edd-diagram-panel edd-diagram-endpoint is-${kind}`}>
      <div className="edd-diagram-endpoint-label">
        <span style={tablet ? { fontSize: "var(--font-size-small)" } : undefined}>
          {kind === "request" ? "IN" : "OUT"}
        </span>
        <strong>{label}</strong>
      </div>
      <dl>
        {fields.map((field) => (
          <div key={field.label}>
            <dt style={tablet ? { fontSize: "var(--font-size-small)" } : undefined}>
              {field.label}
            </dt>
            <dd
              style={tablet ? { fontSize: "var(--font-size-diagram-detail-tablet)" } : undefined}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DiagramStage({
  stage,
  tablet = false,
}: {
  stage: EddHeroVisualDocument["stages"][number];
  tablet?: boolean;
}) {
  return (
    <div className="edd-diagram-panel edd-diagram-stage">
      <div className="edd-diagram-stage-heading">
        <span style={tablet ? { fontSize: "var(--font-size-label)" } : undefined}>
          {stage.number}
        </span>
        <h3>{stage.title}</h3>
      </div>
      <ul>
        {stage.items.map((item) => (
          <li
            key={item.label}
            style={tablet ? { fontSize: "var(--font-size-diagram-detail-tablet)" } : undefined}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagramServiceSvg({
  integration,
  x,
  y,
  width,
  height,
  tablet = false,
}: {
  integration: EddHeroVisualDocument["integrations"][number];
  x: number;
  y: number;
  width: number;
  height: number;
  tablet?: boolean;
}) {
  return (
    <>
      <rect
        className="edd-diagram-service-surface"
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#0f1317"
        stroke="rgba(220, 235, 244, 0.26)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="edd-diagram-service-marker"
        d={`M${x + 14} ${y + 1}H${x + 36}`}
        fill="none"
        stroke="#9ed8f2"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      <text className="edd-diagram-service-name" x={x + 16} y={y + 28} fill="#9ed8f2">
        {integration.name}
      </text>
      <text
        className={`edd-diagram-service-role${tablet ? " is-tablet" : ""}`}
        x={x + 16}
        y={y + 50}
        fill="#687680"
      >
        {integration.role}
      </text>
    </>
  );
}

function findIntegration(visual: EddHeroVisualDocument, integrationKey: string) {
  return visual.integrations.find((integration) => integration.key === integrationKey);
}
