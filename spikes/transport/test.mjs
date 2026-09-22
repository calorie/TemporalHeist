import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel: 'chromium', headless: true, args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=http://web:5173']});
try {
 await Promise.all([1, 2].map(async id => {
  const page = await browser.newPage();
  page.on('console', msg => console.log('browser:', msg.text()));
  await page.goto(`http://web:5173?player=${id}`);
  console.log(await page.evaluate(() => ({secure: isSecureContext, transport: typeof WebTransport, origin: location.origin})));
  await page.waitForFunction(() => window.spikeResult || window.spikeError, {timeout: 30000});
  const result = await page.evaluate(() => window.spikeResult || window.spikeError);
  console.log('spike result', result);
  assert.equal(result.transport, 'webtransport');
  assert.equal(result.payload, 'rust-to-browser');
  assert.equal(result.fetched, 'rust-to-browser');
  console.log(JSON.stringify(result));
 }));
} finally { await browser.close(); }
