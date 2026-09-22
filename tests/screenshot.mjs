import assert from 'node:assert/strict';

export async function captureScreenshot(page, path) {
  const png = await page.screenshot({ path });
  // A valid GPU readback does not prove Chromium composited the canvas into
  // its PNG. Sample unobstructed floor outside the HUD in the actual artifact.
  const scenePixel = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return [...context.getImageData(640, 650, 1, 1).data];
  }, png.toString('base64'));
  assert.equal(scenePixel[3], 255, 'screenshot must contain an opaque WebGPU scene');
  assert(scenePixel.slice(0, 3).some((channel) => channel > 0),
    `screenshot contains a black WebGPU scene: ${scenePixel}`);
  return scenePixel;
}
