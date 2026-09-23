import assert from 'node:assert/strict';

export async function captureScreenshot(page, path, objectiveSecured) {
  const png = await page.screenshot({ path });
  // Inspect the actual PNG: GPU readback alone cannot prove canvas composition.
  const samples = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const floor = [...context.getImageData(640, 650, 1, 1).data];
    const wall = [...context.getImageData(798, 605, 1, 1).data];
    const objective = [...context.getImageData(1083, 360, 1, 1).data];
    // Locate a solid 16x32 body patch in the encounter area. This tolerates
    // movement during capture; the smaller red target marker cannot qualify.
    const area = context.getImageData(780, 100, 380, 500);
    let guard;
    for (const color of [[242, 184, 41], [255, 46, 31], [89, 166, 255]]) {
      const streak = new Uint16Array(area.width);
      for (let y = 0; y < area.height && !guard; y++) {
        let width = 0;
        for (let x = 0; x < area.width; x++) {
          const index = (y * area.width + x) * 4;
          const match = area.data[index + 3] === 255 && color.every((value, channel) =>
            Math.abs(area.data[index + channel] - value) <= 1);
          streak[x] = match ? streak[x] + 1 : 0;
          width = streak[x] >= 32 ? width + 1 : 0;
          if (width >= 16) {
            guard = { pixel: [780 + x - 15, 100 + y - 31], color, width: 16, height: 32 };
            break;
          }
        }
      }
    }
    return { floor, wall, guard, objective };
  }, png.toString('base64'));
  const matches = (actual, expected) => actual.every((value, index) => Math.abs(value - expected[index]) <= 1);
  assert(matches(samples.floor, [9, 23, 31, 255]), `screenshot floor mismatch: ${samples.floor}`);
  assert(matches(samples.wall, [31, 64, 79, 255]), `screenshot wall mismatch: ${samples.wall}`);
  assert(samples.guard, 'screenshot guard body is missing');
  if (objectiveSecured !== undefined) {
    const color = objectiveSecured ? [26, 77, 87, 255] : [20, 230, 255, 255];
    assert(matches(samples.objective, color), `screenshot objective mismatch: ${samples.objective}`);
  }
  return samples;
}
