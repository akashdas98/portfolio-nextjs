/* Standalone browser benchmark. It does not import or modify the production renderer. */
(() => {
  const passes = 3;
  const blurCss = 8.5;
  const coreColor = "#9bc9e3";
  const haloColor = "rgba(59, 168, 230, 0.72)";

  function surface(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function percentiles(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: sorted.length,
      totalMs: values.reduce((a, b) => a + b, 0),
      p50Ms: sorted[Math.floor((sorted.length - 1) * 0.5)] ?? 0,
      p95Ms: sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0,
      maxMs: sorted.at(-1) ?? 0,
    };
  }

  function makeCore(width, height, ratio) {
    const mask = surface(width, height);
    const ctx = mask.getContext("2d", { willReadFrequently: false });
    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Dense, repeatable traces cross both horizontal and vertical tile boundaries.
    let state = 193713;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let index = 0; index < 680; index++) {
      const x = random() * width;
      const y = random() * height;
      const distance = (28 + random() * 240) * ratio;
      const angle = random() * Math.PI * 2;
      ctx.lineWidth = (0.7 + random() * 2.6) * ratio;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
      ctx.stroke();
      if (index % 5 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, (1.5 + random() * 3) * ratio, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = coreColor;
    ctx.fillRect(0, 0, width, height);
    return mask;
  }

  function shadowPass(ctx, source, dx, dy, ratio) {
    ctx.shadowColor = haloColor;
    ctx.shadowBlur = blurCss * ratio;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(source, dx, dy);
  }

  function fullHalo(core, ratio) {
    const first = surface(core.width, core.height);
    const second = surface(core.width, core.height);
    let source = core;
    const calls = [];
    const started = performance.now();
    for (let pass = 0; pass < passes; pass++) {
      const target = pass % 2 === 0 ? first : second;
      const ctx = target.getContext("2d");
      ctx.clearRect(0, 0, target.width, target.height);
      const callStart = performance.now();
      shadowPass(ctx, source, 0, 0, ratio);
      calls.push(performance.now() - callStart);
      source = target;
    }
    return { canvas: first, calls: percentiles(calls), elapsedMs: performance.now() - started };
  }

  function tiledHalo(core, ratio, interiorCss, guardCss) {
    const width = core.width;
    const height = core.height;
    const interior = Math.round(interiorCss * ratio);
    const guard = Math.round(guardCss * ratio);
    const first = surface(width, height);
    const second = surface(width, height);
    let source = core;
    const shadowCalls = [];
    const cropCalls = [];
    const publishCalls = [];
    const started = performance.now();
    let tiles = 0;
    for (let pass = 0; pass < passes; pass++) {
      const target = pass % 2 === 0 ? first : second;
      const destination = target.getContext("2d");
      destination.clearRect(0, 0, width, height);
      for (let y = 0; y < height; y += interior) {
        for (let x = 0; x < width; x += interior) {
          const endX = Math.min(x + interior, width);
          const endY = Math.min(y + interior, height);
          const left = Math.max(0, x - guard);
          const top = Math.max(0, y - guard);
          const right = Math.min(width, endX + guard);
          const bottom = Math.min(height, endY + guard);
          const tileWidth = right - left;
          const tileHeight = bottom - top;
          const localSource = surface(tileWidth, tileHeight);
          const localTarget = surface(tileWidth, tileHeight);
          let callStart = performance.now();
          localSource.getContext("2d").drawImage(
            source, left, top, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight,
          );
          cropCalls.push(performance.now() - callStart);
          callStart = performance.now();
          shadowPass(localTarget.getContext("2d"), localSource, 0, 0, ratio);
          shadowCalls.push(performance.now() - callStart);
          callStart = performance.now();
          destination.drawImage(
            localTarget,
            x - left, y - top, endX - x, endY - y,
            x, y, endX - x, endY - y,
          );
          publishCalls.push(performance.now() - callStart);
          tiles++;
          localSource.width = localSource.height = 0;
          localTarget.width = localTarget.height = 0;
        }
      }
      source = target;
    }
    return {
      canvas: first,
      shadowCalls: percentiles(shadowCalls),
      cropCalls: percentiles(cropCalls),
      publishCalls: percentiles(publishCalls),
      elapsedMs: performance.now() - started,
      tiles,
    };
  }

  function compare(reference, candidate, interior) {
    const width = reference.width;
    const height = reference.height;
    const a = reference.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    const b = candidate.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    let maxChannel = 0;
    let maxSeamChannel = 0;
    let sumChannel = 0;
    let changedPixels = 0;
    let overOne = 0;
    let overFour = 0;
    let seamPixels = 0;
    let seamOverFour = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const seam = Math.min(x % interior, interior - x % interior, y % interior, interior - y % interior) <= 2;
        let pixelMax = 0;
        // Compare alpha and RGB composited on the production dark background.
        for (let channel = 0; channel < 4; channel++) {
          const valueA = channel === 3 ? a[offset + 3] : (a[offset + channel] * a[offset + 3] + 18 * (255 - a[offset + 3])) / 255;
          const valueB = channel === 3 ? b[offset + 3] : (b[offset + channel] * b[offset + 3] + 18 * (255 - b[offset + 3])) / 255;
          pixelMax = Math.max(pixelMax, Math.abs(valueA - valueB));
        }
        maxChannel = Math.max(maxChannel, pixelMax);
        sumChannel += pixelMax;
        if (pixelMax > 0.5) changedPixels++;
        if (pixelMax > 1) overOne++;
        if (pixelMax > 4) overFour++;
        if (seam) {
          seamPixels++;
          maxSeamChannel = Math.max(maxSeamChannel, pixelMax);
          if (pixelMax > 4) seamOverFour++;
        }
      }
    }
    return {
      maxChannel, meanPixelMax: sumChannel / (width * height),
      changedPixels, overOne, overFour,
      seamPixels, seamOverFour, maxSeamChannel,
    };
  }

  function haloPixelCount(core, decorated) {
    const width = core.width;
    const height = core.height;
    const a = core.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    const b = decorated.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    let outsideCore = 0;
    for (let offset = 3; offset < a.length; offset += 4) {
      if (a[offset] === 0 && b[offset] > 0) outsideCore++;
    }
    return outsideCore;
  }

  window.runHaloTileBenchmark = ({ widthCss, heightCss, ratio, interiorCss, guardCss }) => {
    const width = Math.round(widthCss * ratio);
    const height = Math.round(heightCss * ratio);
    const core = makeCore(width, height, ratio);
    const full = fullHalo(core, ratio);
    const tiled = tiledHalo(core, ratio, interiorCss, guardCss);
    const difference = compare(full.canvas, tiled.canvas, Math.round(interiorCss * ratio));
    return {
      dimensions: { width, height, widthCss, heightCss, ratio, interiorCss, guardCss },
      full: { calls: full.calls, elapsedMs: full.elapsedMs },
      tiled: {
        shadowCalls: tiled.shadowCalls, cropCalls: tiled.cropCalls,
        publishCalls: tiled.publishCalls, elapsedMs: tiled.elapsedMs, tiles: tiled.tiles,
      },
      difference,
      haloPixelsOutsideCore: haloPixelCount(core, full.canvas),
    };
  };
})();
