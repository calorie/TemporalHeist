import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const artifacts = `/artifacts/renderer-gpu-${process.env.TH_AGENT_ID}`;
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
      const pending = renderer.samplePixel(...worldPixel(12000 + dx, 4000 + dz, 1280, 720, facility.bounds));
      renderer.render(facility, presentation, 1);
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
  const temporalEvidence = {};
  for (const viewport of [{ width: 1280, height: 720 }, { width: 800, height: 600 }]) {
    const temporalPage = await browser.newPage({ viewport });
    await temporalPage.route('**/temporal-test', (route) => route.fulfill({ contentType: 'text/html',
      body: `<style>body{margin:0}canvas{width:${viewport.width}px;height:${viewport.height}px}</style><canvas></canvas>` }));
    await temporalPage.goto(`${server.resolvedUrls.local[0]}temporal-test`);
    const temporal = await temporalPage.evaluate(async ({ width, height }) => {
      const { WebGpuRenderer } = await import('/src/render/webgpu.ts');
      const { map } = await import('/src/map.ts');
      const { worldPixel } = await import('/src/presentation-view.ts');
      const renderer = await WebGpuRenderer.create(document.querySelector('canvas'));
      const facility = { ...map, walls: [{ minX: 11500, maxX: 12500, minZ: 2800, maxZ: 3200 }],
        doors: [], cameras: [], plates: [], terminals: [] };
      const presentation = { live: [], echoes: [], guards: [], renderTick: 600 };
      const view = { epoch: 'gpu-test', renderTick: 600, owners: [1, 2], segments: [
        { playerId: 1, startTick: 0, endTick: 600, startXmm: 7000, startZmm: 3000, endXmm: 17000, endZmm: 3000 },
        { playerId: 2, startTick: 0, endTick: 600, startXmm: 7000, startZmm: 5000, endXmm: 17000, endZmm: 5000 },
      ], pulses: [
        { playerId: 1, xMm: 19000, zMm: 2500, ageTicks: 0 },
        { playerId: 2, xMm: 19000, zMm: 5500, ageTicks: 59 },
      ] };
      const sample = async (x, z) => {
        const pending = renderer.samplePixel(...worldPixel(x, z, width, height, facility.bounds));
        renderer.render(facility, presentation, 1, view);
        return pending;
      };
      const pixels = {
        oldCyan: await sample(7600, 3000), recentCyan: await sample(16400, 3000),
        oldMagenta: await sample(7600, 5000), recentMagenta: await sample(16400, 5000),
        occluded: await sample(12000, 3000), outside: await sample(12000, 3600), pulseStart: await sample(19280, 2500),
        pulseEnd: await sample(20325, 5500), pulseCenter: await sample(19000, 2500),
      };
      const stats = renderer.temporalStats();
      const overflow = [];
      try { renderer.render(facility, presentation, 1, { ...view, segments: Array(513).fill(view.segments[0]), pulses: [] }); }
      catch (error) { overflow.push(String(error)); }
      try { renderer.render(facility, presentation, 1, { ...view, segments: [], pulses: Array(3).fill(view.pulses[0]) }); }
      catch (error) { overflow.push(String(error)); }
      return { pixels, stats, overflow, errors: renderer.errors(), renderer: renderer.info() };
    }, viewport);
    assert.deepEqual(temporal.errors, []);
    assert(temporal.pixels.oldCyan[2] > temporal.pixels.oldCyan[0]);
    assert(temporal.pixels.recentCyan[2] > temporal.pixels.recentCyan[0] + 20);
    assert(temporal.pixels.oldMagenta[0] > temporal.pixels.oldMagenta[1]);
    assert(temporal.pixels.recentMagenta[0] > temporal.pixels.recentMagenta[1] + 20);
    assert.deepEqual(temporal.pixels.occluded, [31, 64, 79, 255]);
    assert.deepEqual(temporal.pixels.outside, [9, 23, 31, 255]);
    assert(temporal.pixels.pulseStart[2] > temporal.pixels.pulseStart[0]);
    assert(temporal.pixels.pulseEnd[0] > temporal.pixels.pulseEnd[1]);
    assert.deepEqual(temporal.pixels.pulseCenter, [9, 23, 31, 255]);
    assert.deepEqual(temporal.stats, { segmentCapacity: 512, pulseCapacity: 2,
      uploadBytes: 96, segmentCount: 2, pulseCount: 2, drawCount: 2 });
    assert.match(temporal.overflow[0], /segment GPU capacity exceeded: 513 > 512/);
    assert.match(temporal.overflow[1], /pulse GPU capacity exceeded: 3 > 2/);
    temporalEvidence[`${viewport.width}x${viewport.height}`] = temporal;
    await temporalPage.screenshot({ path: `${artifacts}/temporal-${viewport.width}x${viewport.height}.png` });
    await temporalPage.close();
  }
  await writeFile(`${artifacts}/evidence.json`, JSON.stringify({ guard: result, temporal: temporalEvidence }, null, 2));
  console.log(JSON.stringify({ event: 'production-renderer-gpu-passed', guard: result, temporal: temporalEvidence }));
} finally {
  await browser.close();
  await server.close();
}
