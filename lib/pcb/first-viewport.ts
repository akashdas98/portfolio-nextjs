/** Passive enhancements cannot compete with the first static viewport. */
export function afterInitialPcbPaint(page: HTMLElement, run: () => void) {
  let active = true;
  const cancel = () => {
    active = false;
    page.removeEventListener("pcb:viewport-ready", check);
  };
  function check() {
    if (!active || page.querySelector<HTMLElement>(".public-circuit-art")?.dataset.viewportState !== "ready") return;
    cancel();
    run();
  }
  page.addEventListener("pcb:viewport-ready", check);
  check();
  return cancel;
}
