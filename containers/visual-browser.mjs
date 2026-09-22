import { chromium } from '@playwright/test';
import { rm } from 'node:fs/promises';
import net from 'node:net';

await Promise.all(['SingletonLock', 'SingletonCookie', 'SingletonSocket']
  .map((name) => rm(`/browser-profile/${name}`, { force: true })));

const proxy = net.createServer((client) => {
  const chromium = net.connect(9223, '127.0.0.1');
  chromium.on('error', () => client.destroy());
  client.pipe(chromium).pipe(client);
});
await new Promise((resolve, reject) => {
  proxy.once('error', reject);
  proxy.listen(9222, '0.0.0.0', resolve);
});

const context = await chromium.launchPersistentContext('/browser-profile', {
  channel: 'chromium',
  headless: true,
  args: [
    '--no-sandbox',
    '--remote-debugging-address=0.0.0.0',
    '--remote-debugging-port=9223',
    '--enable-unsafe-webgpu',
    '--use-angle=vulkan',
    '--use-vulkan=swiftshader',
    '--enable-features=Vulkan',
    '--disable-vulkan-surface',
    '--enable-unsafe-swiftshader',
    '--unsafely-treat-insecure-origin-as-secure=http://web:5173',
  ],
});

const page = context.pages()[0] ?? await context.newPage();
await page.goto(`http://web:5173/?player=1&room=${process.env.TH_ROOM_ID}`);
await page.waitForFunction(() => window.th?.joined(), { timeout: 30_000 });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    proxy.close();
    await context.close();
    process.exit(0);
  });
}

await new Promise(() => {});
