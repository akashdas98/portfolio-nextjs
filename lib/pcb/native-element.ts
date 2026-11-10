import { mountStaticCircuit } from "./static-engine.ts";

export const PCB_ELEMENT_NAME = "public-pcb-art";
const configurationAttributes = ["data-lens-source", "data-source-width", "data-source-height"];
const surfaceCss = `
:host { display: block; }
[data-pcb-surface] { position: absolute; inset: 0; width: 100%; height: 100%; }
.public-circuit-art-vector {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  will-change: transform;
}`;

/** Constructor injection lets lifecycle ownership be tested without a browser renderer. */
export function createPcbElementClass(Base: typeof HTMLElement, mount = mountStaticCircuit) {
  return class PublicPcbArt extends Base {
    static observedAttributes = configurationAttributes;
    private cleanup: (() => void) | undefined;
    private configuration = "";
    private scheduled = false;

    connectedCallback() { this.schedule(); }
    disconnectedCallback() {
      this.cleanup?.();
      this.cleanup = undefined;
      this.configuration = "";
    }
    attributeChangedCallback() { if (this.isConnected) this.schedule(); }

    private schedule() {
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        if (!this.isConnected) return;
        const configuration = JSON.stringify(configurationAttributes.map((name) => this.getAttribute(name)));
        if (configuration === this.configuration) return;
        this.cleanup?.();
        this.cleanup = undefined;
        this.configuration = configuration;
        const page = this.closest<HTMLElement>("[data-public-circuit]");
        const lensImageUrl = this.getAttribute("data-lens-source") ?? "";
        const sourceWidth = Number(this.getAttribute("data-source-width"));
        const sourceHeight = Number(this.getAttribute("data-source-height"));
        if (!page || !lensImageUrl || lensImageUrl.length > 4_096 || !Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) ||
          sourceWidth <= 0 || sourceHeight <= 0 || sourceWidth > 50_000 || sourceHeight > 50_000) {
          this.dataset.viewportState = "failed";
          this.dataset.currentViewportState = "failed";
          this.dataset.renderState = "error";
          this.dataset.renderError = "Invalid native PCB configuration.";
          this.dispatchEvent(new CustomEvent("pcb:viewport-ready", { bubbles: true }));
          return;
        }
        const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
        let surface = shadow.querySelector<HTMLElement>("[data-pcb-surface]");
        if (!surface) {
          const style = document.createElement("style");
          style.textContent = surfaceCss;
          surface = document.createElement("div");
          surface.dataset.pcbSurface = "";
          shadow.append(style, surface);
        }
        // Initial publication belongs to this host's lifetime. Reconfiguration
        // may prepare a new current viewport without hiding canonical content.
        this.dataset.viewportState ??= "pending";
        this.dataset.currentViewportState = "pending";
        delete this.dataset.renderError;
        try {
          this.cleanup = mount(this, surface, page, { lensImageUrl, sourceWidth, sourceHeight });
        } catch (error) {
          this.dataset.viewportState = "failed";
          this.dataset.currentViewportState = "failed";
          this.dataset.renderState = "error";
          this.dataset.renderError = error instanceof Error ? error.message : "Native PCB initialization failed.";
          this.dispatchEvent(new CustomEvent("pcb:viewport-ready", { bubbles: true }));
        }
      });
    }
  };
}

export function registerPcbElement() {
  if (!customElements.get(PCB_ELEMENT_NAME)) {
    customElements.define(PCB_ELEMENT_NAME, createPcbElementClass(HTMLElement));
  }
}
