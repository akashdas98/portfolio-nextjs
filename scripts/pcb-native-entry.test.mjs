import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createPcbElementClass } from "../lib/pcb/native-element.ts";
import { createNativeBuild } from "./build-pcb-native.mjs";

const tick = () => new Promise((resolve) => queueMicrotask(resolve));

test("independently evaluated browser facades share one broker and never create server state", async () => {
  const native = await import("../lib/pcb/browser-geometry.ts?native");
  assert.throws(() => native.getBrowserGeometryDelivery(), /cannot run on the server/);
  globalThis.window = {};
  try {
    const react = await import("../lib/pcb/browser-geometry.ts?react");
    assert.strictEqual(native.getBrowserGeometryDelivery(), react.getBrowserGeometryDelivery());
    assert.strictEqual(window[Symbol.for(native.PCB_GEOMETRY_BROKER_KEY)], native.getBrowserGeometryDelivery());
  } finally { delete globalThis.window; }
});

function elementFixture(mount) {
  const page = {};
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ dataset: {} }) };
  class Base extends EventTarget {
    isConnected = true;
    dataset = {};
    attrs = new Map([["data-lens-source", "source"], ["data-source-width", "2400"], ["data-source-height", "11789"]]);
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    closest() { return page; }
    attachShadow() {
      const children = [];
      return this.shadowRoot = { children, querySelector() { return children.find((child) => "pcbSurface" in child.dataset); },
        append(...nodes) { children.push(...nodes); } };
    }
  }
  const Element = createPcbElementClass(Base, mount);
  return { element: new Element(), restore() { globalThis.document = oldDocument; } };
}

test("connect/configuration/reconnect coalesce ownership and never duplicate the shadow surface", async () => {
  let mounted = 0, cleaned = 0;
  const surfaces = [];
  const fixture = elementFixture((_host, surface) => {
    mounted += 1; surfaces.push(surface); return () => { cleaned += 1; };
  });
  try {
    const { element } = fixture;
    element.connectedCallback(); element.connectedCallback(); await tick();
    assert.equal(mounted, 1);
    element.attrs.set("data-source-width", "1200");
    element.attributeChangedCallback(); element.attributeChangedCallback(); await tick();
    assert.equal(mounted, 2); assert.equal(cleaned, 1);
    element.isConnected = false; element.disconnectedCallback();
    assert.equal(cleaned, 2);
    element.isConnected = true; element.connectedCallback(); await tick();
    assert.equal(mounted, 3);
    assert.equal(element.shadowRoot.children.length, 2);
    assert.ok(surfaces.every((surface) => surface === surfaces[0]));
    element.connectedCallback(); await tick(); assert.equal(mounted, 3);
    element.isConnected = false; element.disconnectedCallback();
  } finally { fixture.restore(); }
});

test("detached queued mounts do nothing and invalid/native failures publish the compatible terminal state", async () => {
  let mounted = 0, events = 0;
  const fixture = elementFixture(() => { mounted += 1; throw new Error("fixture mount failure"); });
  try {
    const { element } = fixture;
    element.addEventListener("pcb:viewport-ready", () => { events += 1; });
    element.connectedCallback(); element.isConnected = false; element.disconnectedCallback(); await tick();
    assert.equal(mounted, 0);
    element.attrs.set("data-source-width", "0"); element.isConnected = true; element.connectedCallback(); await tick();
    assert.equal(mounted, 0); assert.equal(events, 1); assert.equal(element.dataset.viewportState, "failed");
    element.attrs.set("data-source-width", "2400"); element.attributeChangedCallback(); await tick();
    assert.equal(mounted, 1); assert.equal(events, 2); assert.equal(element.dataset.currentViewportState, "failed");
    assert.match(element.dataset.renderError, /fixture mount failure/);
  } finally { fixture.restore(); }
});

test("published initial outcome survives configuration and reconnect while current viewport prepares", async () => {
  for (const outcome of ["ready", "failed"]) {
    let mounted = 0, cleaned = 0;
    const fixture = elementFixture(() => {
      mounted += 1;
      return () => { cleaned += 1; };
    });
    try {
      const { element } = fixture;
      element.connectedCallback(); await tick();
      assert.equal(element.dataset.viewportState, "pending", "a new host begins pending");
      element.dataset.viewportState = outcome;
      element.dataset.currentViewportState = outcome;
      element.dataset.firstViewportMs = "2088";
      element.dataset.startupEntrance = outcome === "ready" ? "ready" : "expired";
      const entrance = element.dataset.startupEntrance;
      element.attrs.set("data-source-width", "1200");
      element.attributeChangedCallback(); await tick();
      assert.equal(element.dataset.viewportState, outcome);
      assert.equal(element.dataset.currentViewportState, "pending");
      assert.equal(element.dataset.firstViewportMs, "2088");
      assert.equal(element.dataset.startupEntrance, entrance);
      element.isConnected = false; element.disconnectedCallback();
      element.isConnected = true; element.connectedCallback(); await tick();
      assert.equal(mounted, 3); assert.equal(cleaned, 2);
      assert.equal(element.dataset.viewportState, outcome);
      assert.equal(element.dataset.currentViewportState, "pending");
      assert.equal(element.dataset.firstViewportMs, "2088");
      assert.equal(element.dataset.startupEntrance, entrance);
      assert.equal(element.shadowRoot.children.length, 2);
      element.isConnected = false; element.disconnectedCallback();
    } finally { fixture.restore(); }
  }
});

test("native build has a content-addressed manifest and excludes framework/interaction graphs", async () => {
  const result = await createNativeBuild();
  const manifest = JSON.parse(await readFile(new URL("../lib/pcb/native-entry-manifest.json", import.meta.url), "utf8"));
  const content = await readFile(new URL(`../public${manifest.src}`, import.meta.url));
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 20);
  assert.equal(manifest.src, `/_pcb/entry-${hash}.js`);
  assert.ok(Object.keys(result.metafile.inputs).every((input) => !/node_modules|Interaction|PublicAnimations/.test(input)));
  assert.equal(content.includes(Buffer.from("dev-version.json")), false, "production entry has no dev polling");
});
