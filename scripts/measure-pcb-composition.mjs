const endpoint = process.argv[2];
if (!endpoint || process.argv.length !== 3) {
  throw new Error("Usage: node scripts/measure-pcb-composition.mjs <page-websocket-url>");
}

const socket = new WebSocket(endpoint);
let nextId = 0;
const pending = new Map();

socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const widths = [390, 768, 1440];
const measurements = [];
for (const width of widths) {
  await send("Emulation.setDeviceMetricsOverride", {
    width, height: 900, deviceScaleFactor: 1, mobile: width < 650,
  });
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const result = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const page = document.querySelector('[data-public-circuit]');
      const pageRect = page.getBoundingClientRect();
      const pageTop = pageRect.top + scrollY;
      return {
        width: pageRect.width,
        height: page.offsetHeight,
        sections: Array.from(page.querySelectorAll(':scope > section')).map((section) => {
          const rect = section.getBoundingClientRect();
          return {
            className: section.className,
            top: rect.top + scrollY - pageTop,
            bottom: rect.bottom + scrollY - pageTop,
            backgroundColor: getComputedStyle(section).backgroundColor,
          };
        }),
      };
    })()`,
  });
  measurements.push(result.result.value);
}

socket.close();
process.stdout.write(`${JSON.stringify(measurements, null, 2)}\n`);
