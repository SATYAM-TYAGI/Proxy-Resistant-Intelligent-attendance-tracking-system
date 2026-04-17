/**
 * Grab a small burst of JPEG base64 frames from a video element (no data: prefix).
 * Tuned for latency: low resolution + moderate quality.
 */
export async function captureFramesFromVideo(videoEl, { maxWidth = 400, quality = 0.52, durationMs = 2600, minIntervalMs = 320 } = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const frames = [];
  const start = performance.now();

  await new Promise((resolve) => {
    function tick() {
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) {
        resolve();
        return;
      }
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (vw && vh) {
        const scale = Math.min(1, maxWidth / vw);
        canvas.width = Math.round(vw * scale);
        canvas.height = Math.round(vh * scale);
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const b64 = dataUrl.split(",")[1];
        if (b64) frames.push(b64);
      }
      setTimeout(tick, minIntervalMs);
    }
    tick();
  });

  return frames;
}
