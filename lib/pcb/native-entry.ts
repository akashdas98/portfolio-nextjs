import { registerPcbElement } from "./native-element.ts";

registerPcbElement();

declare const __PCB_DEVELOPMENT__: boolean;
if (__PCB_DEVELOPMENT__) {
  // Native source changes need a full document reload: custom-element classes
  // cannot be redefined by framework HMR. The managed dev builder owns this file.
  const current = new URL(import.meta.url).pathname;
  window.setInterval(() => {
    void fetch("/_pcb/dev-version.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Native development version unavailable.");
      return response.json();
    }).then((manifest: { src?: string }) => {
      if (manifest.src && manifest.src !== current) window.location.reload();
    }).catch(() => {});
  }, 1_000);
}
