import { preload } from "react-dom";
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
  preload(bootstrap.href, {
    as: "fetch",
    fetchPriority: "high",
    media: "(scripting: enabled)",
  });
  return null;
}
