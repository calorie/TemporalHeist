import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const artifacts = `/artifacts/gpu-${process.env.TH_AGENT_ID}`;
await mkdir(artifacts, { recursive: true });
const server = await createServer({ root: 'spikes/gpu', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser;
try {
  browser = await chromium.launchPersistentContext(`${artifacts}/profile`, {
    headless: true,
    channel: 'chromium',
    args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--use-vulkan=swiftshader',
      '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  const result = await page.evaluate(() => window.gpuResult);
  if (pageErrors.length) throw new Error(pageErrors.join('\n'));
  await page.screenshot({ path: `${artifacts}/primitive.png` });
  const session = await browser.browser().newBrowserCDPSession();
  const system = await session.send('SystemInfo.getInfo');
  const evidence = { agent: process.env.TH_AGENT_ID, browser: browser.browser().version(),
    gpuDevices: system.gpu.devices, glRenderer: system.gpu.auxAttributes.glRenderer, ...result };
  await writeFile(`${artifacts}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
