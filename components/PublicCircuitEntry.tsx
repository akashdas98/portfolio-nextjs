import manifest from "@/lib/pcb/native-entry-manifest.json";

/** A native module executes independently of framework bootstrap/hydration. */
export function PublicCircuitEntry() {
  return <script type="module" src={manifest.src} fetchPriority="high" />;
}
