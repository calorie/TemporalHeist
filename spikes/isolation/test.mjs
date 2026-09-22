import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const root = `/artifacts/isolation-${process.env.TH_AGENT_ID}`;
await mkdir(root, { recursive: true });
const browsers = [];
const started = new Date().toISOString();
try {
  const results = await Promise.all([1, 2].map(async (id) => {
    const context = await chromium.launchPersistentContext(`${root}/client-${id}`, {
      channel: 'chromium', headless: true,
      args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=http://web:5173'],
    });
    browsers.push(context);
    const page = await context.newPage();
    await page.goto(`http://web:5173?player=${id}`);
    await page.waitForFunction(() => window.spikeResult || window.spikeError, { timeout: 60000 });
    const result = await page.evaluate(() => window.spikeResult || window.spikeError);
    assert.equal(result.transport, 'webtransport');
    assert.equal(result.payload, 'rust-to-browser');
    assert.equal(result.fetched, 'rust-to-browser');
    await page.screenshot({ path: `${root}/client-${id}.png` });
    return { id, ...result };
  }));
  console.log(JSON.stringify({ event: 'both-clients-passed-and-held', agent: process.env.TH_AGENT_ID, started, results }));
  await new Promise((resolve) => setTimeout(resolve, Number(process.env.TH_HOLD_MS ?? 45000)));
  const evidence = { agent: process.env.TH_AGENT_ID, started, ended: new Date().toISOString(), results };
  await writeFile(`${root}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
} finally {
  await Promise.all(browsers.map((browser) => browser.close()));
}
