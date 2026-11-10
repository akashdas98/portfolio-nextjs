import { createGeometryDeliveryBroker } from "./geometry-delivery.ts";

export const PCB_GEOMETRY_BROKER_KEY = "portfolio.pcb.geometry.v2";
type Broker = ReturnType<typeof createGeometryDeliveryBroker>;

/** Symbol.for joins native and framework bundles in one browser realm only. */
export function getBrowserGeometryDelivery(): Broker {
  if (typeof window === "undefined") throw new Error("PCB browser geometry cannot run on the server.");
  const key = Symbol.for(PCB_GEOMETRY_BROKER_KEY);
  const realm = window as unknown as Record<symbol, Broker>;
  return realm[key] ?? (realm[key] = createGeometryDeliveryBroker());
}
