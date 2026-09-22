import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';

const artifacts = `/artifacts/visual-${process.env.TH_AGENT_ID}`;
const viewport = { width: 1280, height: 720 };

await Promise.all(['SingletonLock', 'SingletonCookie', 'SingletonSocket']
  .map((name) => rm(`/browser-profile/${name}`, { force: true })));
await mkdir(artifacts, { recursive: true });

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
  viewport,
  deviceScaleFactor: 1,
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

const clients = [];
for (const player of [1, 2]) {
  const page = player === 1
    ? context.pages()[0] ?? await context.newPage()
    : await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`http://web:5173/?player=${player}&room=${process.env.TH_ROOM_ID}`);
  await page.waitForFunction(() => window.th?.joined(), undefined, { timeout: 45_000 });
  clients.push({ page, pageErrors, player });
}

await Promise.all(clients.map(({ page }) => page.waitForFunction(
  () => window.th?.snapshot()?.sessions.filter((session) => session.connected).length === 2,
  undefined,
  { timeout: 45_000 },
)));

const captures = [];
for (const { page, pageErrors, player } of clients) {
  const file = `player-${player}-lobby.png`;
  await page.screenshot({ path: `${artifacts}/${file}` });
  captures.push(await page.evaluate(({ file, pageErrors, player }) => ({
    file,
    player,
    title: document.title,
    url: location.href,
    viewport: {
      width: innerWidth,
      height: innerHeight,
      deviceScaleFactor: devicePixelRatio,
    },
    hud: {
      phase: document.querySelector('#phase')?.textContent,
      objective: document.querySelector('#objective')?.textContent,
      echo: document.querySelector('#echo-status')?.textContent,
    },
    renderer: window.th.rendererInfo(),
    errors: [...pageErrors, ...window.th.errors()],
  }), { file, pageErrors, player }));
}
await writeFile(`${artifacts}/metadata.json`, `${JSON.stringify({
  agent: process.env.TH_AGENT_ID,
  room: process.env.TH_ROOM_ID,
  captures,
}, null, 2)}\n`);
console.log(JSON.stringify({ event: 'visual-evidence-ready', artifacts, captures }));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    proxy.close();
    await context.close();
    process.exit(0);
  });
}

await new Promise(() => {});
