import { createPcbBootstrap } from "@/lib/pcb/bootstrap";

/** Start the exact bounded response consumed by the static geometry broker. */
export function PublicCircuitPreload({
  source,
  width,
  height,
}: {
  source: string;
  width: number;
  height: number;
}) {
  const bootstrap = createPcbBootstrap(source, width, height);
  // A host element must reach streamed case-study HTML itself. An imperative
  // React preload hint can remain in Flight until the application scripts run.
  return (
    <link
      rel="preload"
      href={bootstrap.href}
      as="fetch"
      fetchPriority="high"
      media="(scripting: enabled)"
    />
  );
}
