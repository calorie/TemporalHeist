import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  channel: 'chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--use-vulkan=swiftshader', '--enable-features=Vulkan,UseSkiaRenderer,WebGPUService'],
});
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto('http://127.0.0.1:5173?player=1');
  await page.waitForFunction(() => window.th?.rendererInfo()?.backend === 'webgpu', { timeout: 20_000 });
  const result = await page.evaluate(() => ({
    info: window.th.rendererInfo(),
    errors: window.th.errors(),
    canvas: { width: document.querySelector('canvas').width, height: document.querySelector('canvas').height },
    lifecycleApi: typeof window.th.ready === 'function' && typeof window.th.restart === 'function',
    lifecycleHud: ['phase', 'objective', 'timer', 'readiness', 'result', 'ready', 'restart'].every((id) => Boolean(document.getElementById(id))),
  }));
  assert.equal(result.info.backend, 'webgpu');
  assert.ok(result.canvas.width > 0 && result.canvas.height > 0);
  assert.equal(result.lifecycleApi, true);
  assert.equal(result.lifecycleHud, true);
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
