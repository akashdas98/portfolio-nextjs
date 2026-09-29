# v2 PCB first-paint correction

The user clarified that restored internet speed resolved most live loading delay: project pages worked normally, while the homepage remained slower. The remaining visual defect was incremental tile publication and UI appearing before artwork. Earlier long-running traces are historical delivery evidence, not proof that all routes still stall.

The static renderer now decodes every tile intersecting the current viewport before publishing that group in one DOM operation. Two animation frames separate publication from the initial UI entrance. Belowfold geometry and snapshots continue independently, and scrolling publishes newly visible groups together. Completed replacement layouts remain atomic; resizing an incomplete startup layout prioritizes its new viewport.

Regional geometry requests batch at most eight regions, preserve deduplicated source order and exact path strings, and share fulfilled spatial coverage with hover/touch consumers. A covering result can satisfy an already waiting narrower request. Two snapshot workers and sixteen staged tile promises bound preparation; transport deadlines include response bodies and retry transient failures once. Existing source geometry, Storage ownership, palettes and pointer renderers are unchanged.

UI entrances and chrome use the artwork readiness event, preserving belowfold reveal timing and reduced-motion preference. Without JavaScript content remains visible. A bounded eight-second release prevents an interrupted initialization from keeping canonical content hidden; completed content is never hidden again.

Verification: TypeScript/production build passed. Geometry/touch tests: 57 passed, one existing browser-only pixel check skipped. Chromium and installed WebKit each passed desktop/laptop/mobile/reduced-motion/no-JavaScript first-paint checks, including deliberately delayed geometry. All four public routes passed local hover/touch, scrolling and resizing. API batch results matched single-region path arrays exactly; invalid batches returned uncached 400. Artwork failure released content. Desktop/mobile screenshots were inspected.

Deployment and fresh live evidence remain pending until recorded below. Physical-device gesture/zoom behavior remains covered by prior accepted evidence; desktop emulation is not a new physical-iPad verification.
