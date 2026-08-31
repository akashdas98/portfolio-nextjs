import { z } from "zod";

const toneSchema = z.enum(["base", "muted"]);

export const caseStudyBackgroundSchema = z.object({
  type: z.literal("pcb-svg"),
  bucket: z.literal("case-study-assets"),
  objectPath: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-z0-9][a-z0-9._/-]*\.svg$/)
    .refine((path) => !path.split("/").includes(".."), "Invalid storage object path."),
  lensObjectPath: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-z0-9][a-z0-9._/-]*\.svg$/)
    .refine((path) => !path.split("/").includes(".."), "Invalid lens storage object path.")
    .optional(),
  width: z.number().finite().positive().max(50000),
  height: z.number().finite().positive().max(50000),
});

const diagramNumberSchema = z.number().finite().min(-2000).max(4000);
const diagramSizeSchema = z.number().finite().positive().max(4000);
const diagramPathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9,.+\-\s]+$/);

const diagramPointSchema = z.object({
  x: diagramNumberSchema,
  y: diagramNumberSchema,
});

const diagramRectSchema = diagramPointSchema.extend({
  width: diagramSizeSchema,
  height: diagramSizeSchema,
});

const diagramFieldSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

const diagramStageItemSchema = z.union([
  z.string().min(1).transform((label) => ({ label, sourceKey: undefined })),
  z.object({
    label: z.string().min(1),
    sourceKey: z.string().min(1).optional(),
  }),
]);

const diagramIntegrationSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  role: z.string().min(1),
});

const diagramServiceLayoutSchema = diagramRectSchema.extend({
  integrationKey: z.string().min(1),
  path: diagramPathSchema,
});

const diagramWideLayoutSchema = z.object({
  boundary: diagramRectSchema,
  request: diagramRectSchema,
  response: diagramRectSchema,
  stageSize: z.object({
    width: diagramSizeSchema,
    height: diagramSizeSchema,
  }),
  stagePositions: z.array(diagramPointSchema).length(4),
  flowPaths: z.array(diagramPathSchema).length(5),
  services: z.array(diagramServiceLayoutSchema).min(1),
});

const diagramMobileConnectionSchema = z.object({
  from: z.string().min(1).regex(/^[a-z0-9-]+$/),
  to: z.string().min(1).regex(/^[a-z0-9-]+$/),
  kind: z.enum(["primary", "api"]),
});

const diagramMobileLayoutSchema = z.object({
  groupLabel: z.string().min(1),
  canvasPadding: diagramSizeSchema,
  compactCanvasPadding: diagramSizeSchema,
  endpointPadding: diagramSizeSchema,
  compactEndpointPadding: diagramSizeSchema,
  enginePadding: diagramSizeSchema,
  compactEnginePadding: diagramSizeSchema,
  entryColumns: z.array(diagramSizeSchema).length(3),
  entryPaddingTop: diagramSizeSchema,
  entryPaddingBottom: diagramSizeSchema,
  integrationPadding: diagramSizeSchema,
  compactIntegrationPadding: diagramSizeSchema,
  integrationConnectorHeight: diagramSizeSchema,
  integrationConnectorGap: diagramSizeSchema,
  responseConnectorHeight: diagramSizeSchema,
  stageGap: diagramSizeSchema,
  stagePadding: diagramSizeSchema,
  compactStagePadding: diagramSizeSchema,
  compactStageHeaderPadding: diagramSizeSchema,
  compactFieldRows: z.object({
    labelMinWidth: diagramSizeSchema,
    labelFraction: diagramSizeSchema,
    valueFraction: diagramSizeSchema,
    gap: diagramSizeSchema,
    paddingBlock: diagramSizeSchema,
  }),
  stageColumns: z.object({
    titleMinWidth: diagramSizeSchema,
    titleFraction: diagramSizeSchema,
    detailsFraction: diagramSizeSchema,
    gap: diagramSizeSchema,
    compactGap: diagramSizeSchema,
  }),
  integrationPositions: z
    .array(
      z.object({
        integrationKey: z.string().min(1),
        column: z.number().int().min(1).max(3),
      }),
    )
    .min(1),
  connections: z.array(diagramMobileConnectionSchema).min(1),
});

const diagramLayoutSchema = z.object({
  breakpoints: z.object({
    compactMax: z.number().int().positive().max(2000),
    mobileMax: z.number().int().positive().max(2000),
    tabletMax: z.number().int().positive().max(3000),
  }),
  canvas: z.object({
    width: diagramSizeSchema,
    height: diagramSizeSchema,
    frameInset: diagramNumberSchema.min(0),
    gridSize: diagramSizeSchema,
  }),
  desktop: diagramWideLayoutSchema,
  tablet: diagramWideLayoutSchema,
  mobile: diagramMobileLayoutSchema,
});

const eddHeroVisualSchema = z
  .object({
    type: z.literal("edd-calculation"),
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    requestLabel: z.string().min(1),
    requestFields: z.array(diagramFieldSchema).length(3),
    integrations: z.array(diagramIntegrationSchema).min(1),
    stages: z
      .array(
        z.object({
          number: z.string().min(1),
          title: z.string().min(1),
          items: z.array(diagramStageItemSchema).length(3),
        }),
      )
      .length(4),
    responseLabel: z.string().min(1),
    responseFields: z.array(diagramFieldSchema).length(3),
    layout: diagramLayoutSchema,
  })
  .superRefine((visual, context) => {
    const { compactMax, mobileMax, tabletMax } = visual.layout.breakpoints;
    if (!(compactMax < mobileMax && mobileMax < tabletMax)) {
      context.addIssue({
        code: "custom",
        path: ["layout", "breakpoints"],
        message: "Diagram breakpoints must increase from compact to mobile to tablet.",
      });
    }

    const integrationKeys = new Set(visual.integrations.map((integration) => integration.key));
    const referencedKeys = [
      ...visual.stages.flatMap((stage) =>
        stage.items.flatMap((item) => (item.sourceKey ? [item.sourceKey] : [])),
      ),
      ...visual.layout.desktop.services.map((service) => service.integrationKey),
      ...visual.layout.tablet.services.map((service) => service.integrationKey),
      ...visual.layout.mobile.integrationPositions.map((item) => item.integrationKey),
      ...visual.layout.mobile.connections.flatMap((connection) =>
        [connection.from, connection.to].filter(
          (key) => key !== "request" && key !== "engine" && key !== "response",
        ),
      ),
    ];

    referencedKeys.forEach((key) => {
      if (!integrationKeys.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["integrations"],
          message: `Unknown integration key: ${key}`,
        });
      }
    });
  });

const leadNetworkNodeSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  role: z.string().min(1),
});

const leadNetworkHeroVisualSchema = z.object({
  type: z.literal("lead-network"),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  sourceLabel: z.string().min(1),
  sourceStat: z.string().min(1),
  sourceStatLabel: z.string().min(1),
  sources: z.array(leadNetworkNodeSchema).min(2).max(6),
  serviceLabel: z.string().min(1),
  serviceRole: z.string().min(1),
  stages: z
    .array(
      z.object({
        number: z.string().min(1),
        title: z.string().min(1),
        detail: z.string().min(1),
      }),
    )
    .min(3)
    .max(6),
  record: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    detail: z.string().min(1),
  }),
  destinationLabel: z.string().min(1),
  destinations: z.array(leadNetworkNodeSchema).min(2).max(6),
  layout: z.object({
    breakpoints: z.object({
      compactMax: z.number().int().positive().max(2000),
      mobileMax: z.number().int().positive().max(2000),
      tabletMax: z.number().int().positive().max(2000),
    }),
    canvas: z.object({
      width: diagramSizeSchema,
      height: diagramSizeSchema,
      frameInset: diagramNumberSchema.min(0),
      gridSize: diagramSizeSchema,
    }),
    wide: z.object({
      sourceX: diagramNumberSchema,
      destinationX: diagramNumberSchema,
      laneWidth: diagramSizeSchema,
      titleY: diagramNumberSchema,
      statY: diagramNumberSchema,
      sourceRuleY: diagramNumberSchema,
      destinationRuleY: diagramNumberSchema,
      nodeStartY: diagramNumberSchema,
      nodeGap: diagramSizeSchema,
      nodeWidth: diagramSizeSchema,
      nodeHeight: diagramSizeSchema,
      nodeTextX: diagramSizeSchema,
      nodeTitleY: diagramSizeSchema,
      nodeDetailY: diagramSizeSchema,
      nodeAccentStartX: diagramSizeSchema,
      nodeAccentEndX: diagramSizeSchema,
      core: diagramRectSchema,
      sourceConnectorPath: diagramPathSchema,
      destinationConnectorPath: diagramPathSchema,
    }),
  }),
}).superRefine((visual, context) => {
  const { compactMax, mobileMax, tabletMax } = visual.layout.breakpoints;
  if (!(compactMax < mobileMax && mobileMax < tabletMax)) {
    context.addIssue({
      code: "custom",
      path: ["layout", "breakpoints"],
      message: "Lead-network breakpoints must increase from compact to mobile to tablet.",
    });
  }
});

const horecahFeatureHeroVisualSchema = z.object({
  type: z.literal("cross-platform-features"),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  platforms: z.array(z.string().min(1)).length(3),
  sharedCore: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
  }),
  features: z
    .array(
      z.object({
        key: z.string().min(1).regex(/^[a-z0-9-]+$/),
        name: z.string().min(1),
        role: z.string().min(1),
        steps: z.array(z.string().min(1)).min(3).max(5),
      }),
    )
    .length(2),
  layout: z
    .object({
      breakpoints: z.object({
        stackMax: z.number().int().positive().max(2000),
        fullCoreMax: z.number().int().positive().max(2000),
      }),
    })
    .superRefine((layout, context) => {
      if (!(layout.breakpoints.stackMax < layout.breakpoints.fullCoreMax)) {
        context.addIssue({
          code: "custom",
          path: ["breakpoints"],
          message: "Cross-platform diagram breakpoints must increase from stack to full-core.",
        });
      }
    }),
});

const evidenceCardSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  keywords: z.array(z.string().min(1)),
});

const sectionHeadingSchema = {
  id: z.string().min(1),
  tone: toneSchema,
  eyebrow: z.string().min(1),
  title: z.string().min(1),
};

const outcomeSectionSchema = z.object({
  ...sectionHeadingSchema,
  type: z.literal("outcome-table"),
  rows: z.array(
    z.object({
      metric: z.string().min(1),
      before: z.string().min(1),
      after: z.string().min(1),
      impact: z.string().min(1),
    }),
  ),
  footer: z.object({
    value: z.string().min(1),
    label: z.string().min(1),
    detail: z.string().min(1),
  }),
});

const comparisonSectionSchema = z.object({
  ...sectionHeadingSchema,
  type: z.literal("comparison"),
  beforeLabel: z.string().min(1),
  afterLabel: z.string().min(1),
  items: z.array(
    z.object({
      before: z.string().min(1),
      after: z.string().min(1),
    }),
  ),
});

const systemFlowSectionSchema = z.object({
  ...sectionHeadingSchema,
  type: z.literal("system-flow"),
  items: z.array(
    z.object({
      step: z.string().min(1),
      title: z.string().min(1),
      detail: z.string().min(1),
      stat: z.string().min(1),
      statLabel: z.string().min(1),
    }),
  ),
});

const workflowSectionSchema = z.object({
  ...sectionHeadingSchema,
  type: z.literal("workflow"),
  intro: z.string().min(1),
  steps: z.array(z.string().min(1)),
  cards: z.array(evidenceCardSchema),
});

const evidenceGridSectionSchema = z.object({
  ...sectionHeadingSchema,
  type: z.literal("evidence-grid"),
  cards: z.array(evidenceCardSchema),
  columns: z.union([z.literal(2), z.literal(3)]).optional(),
  circuitAnchor: z.enum(["section-bottom"]).optional(),
});

const impactHighlightSectionSchema = z.object({
  ...sectionHeadingSchema,
  type: z.literal("impact-highlight"),
  detail: z.string().min(1),
  capabilities: z.array(z.string().min(1)).min(1).max(4).optional(),
  metrics: z
    .array(
      z.object({
        value: z.string().min(1),
        label: z.string().min(1),
      }),
    )
    .min(1)
    .max(4),
  circuitAnchor: z.enum(["section-bottom"]).optional(),
});

const capabilitySectionSchema = z.object({
  ...sectionHeadingSchema,
  type: z.literal("capability-band"),
  showProjectCapabilities: z.boolean().default(true),
  primaryActionLabel: z.string().min(1),
  secondaryActionLabel: z.string().min(1),
});

export const caseStudySectionSchema = z.discriminatedUnion("type", [
  outcomeSectionSchema,
  comparisonSectionSchema,
  systemFlowSectionSchema,
  workflowSectionSchema,
  evidenceGridSectionSchema,
  impactHighlightSectionSchema,
  capabilitySectionSchema,
]);

export const caseStudyDocumentSchema = z.object({
  schemaVersion: z.literal(3),
  background: caseStudyBackgroundSchema,
  summary: z.string().min(1),
  role: z.string().min(1),
  heroVisual: z
    .discriminatedUnion("type", [
      eddHeroVisualSchema,
      leadNetworkHeroVisualSchema,
      horecahFeatureHeroVisualSchema,
    ])
    .optional(),
  sections: z.array(caseStudySectionSchema).min(1),
});

export type CaseStudyDocument = z.infer<typeof caseStudyDocumentSchema>;
export type CaseStudyBackground = z.infer<typeof caseStudyBackgroundSchema>;
export type CaseStudySectionDocument = z.infer<typeof caseStudySectionSchema>;
export type EddHeroVisualDocument = z.infer<typeof eddHeroVisualSchema>;
export type LeadNetworkHeroVisualDocument = z.infer<typeof leadNetworkHeroVisualSchema>;
export type HorecahFeatureHeroVisualDocument = z.infer<typeof horecahFeatureHeroVisualSchema>;

export function parseCaseStudyDocument(value: unknown): CaseStudyDocument | null {
  const result = caseStudyDocumentSchema.safeParse(value);
  return result.success ? result.data : null;
}
