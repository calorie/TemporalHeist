import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const artifacts = `/artifacts/guard-cone-${process.env.TH_AGENT_ID}`;
await mkdir(artifacts, { recursive: true });
const server = await createServer({ root: 'apps/web', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium', args: [
  '--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--use-vulkan=swiftshader',
  '--enable-features=Vulkan', '--enable-unsafe-swiftshader',
] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route('**/cone-test', (route) => route.fulfill({ contentType: 'text/html',
    body: '<style>body{margin:0}canvas{width:1280px;height:720px}</style><canvas></canvas>' }));
  await page.goto(`${server.resolvedUrls.local[0]}cone-test`);
  const result = await page.evaluate(async () => {
    const { WebGpuRenderer } = await import('/src/render/webgpu.ts');
    const { map } = await import('/src/map.ts');
    const { worldPixel } = await import('/src/presentation-view.ts');
    const renderer = await WebGpuRenderer.create(document.querySelector('canvas'));
    const facility = { ...map, walls: [], doors: [], cameras: [], plates: [], terminals: [] };
    const presentation = { live: [], echoes: [], renderTick: 0, guards: [{
      id: 51, xMm: 12000, zMm: 4000, facingX: 1000, facingZ: 0, state: 1,
      waypointId: 512, stateEnteredTick: 0, searchExpiresTick: 0,
    }] };
    const samples = {};
    for (const [name, dx, dz] of [['inside', 2200, 1000], ['farCorner', 2500, 1200], ['outsideAngle', 2000, 1200]]) {
      const pending = renderer.samplePixel(...worldPixel(12000 + dx, 4000 + dz, 1280, 720));
      renderer.render(facility, presentation);
      samples[name] = await pending;
    }
    return { samples, errors: renderer.errors(), renderer: renderer.info() };
  });
  await page.screenshot({ path: `${artifacts}/radial-cone.png` });
  await writeFile(`${artifacts}/evidence.json`, JSON.stringify(result, null, 2));
  assert.deepEqual(result.errors, []);
  assert(result.samples.inside[1] > result.samples.inside[0] + 15);
  assert.deepEqual(result.samples.farCorner, [9, 23, 31, 255],
    'authority rejects the triangular far corner outside radial range; renderer must show floor');
  assert.deepEqual(result.samples.outsideAngle, [9, 23, 31, 255]);
  console.log(JSON.stringify({ event: 'guard-cone-parity-passed', ...result }));
} finally {
  await browser.close();
  await server.close();
}
