import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({
  root: 'apps/web',
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });

try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 800, height: 600 }]) {
    const page = await browser.newPage({ viewport });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${server.resolvedUrls.local[0]}?player=1`);

    const semantics = await page.evaluate(() => ({
      canvasRole: document.querySelector('#game')?.getAttribute('role'),
      canvasLabel: document.querySelector('#game')?.getAttribute('aria-label'),
      canvasDescription: document.querySelector('#game')?.getAttribute('aria-describedby'),
      hudLabel: document.querySelector('#hud')?.getAttribute('aria-label'),
      objectiveLive: document.querySelector('#objective')?.getAttribute('aria-live'),
      readinessLive: document.querySelector('#readiness')?.getAttribute('aria-live'),
    }));
    assert.equal(semantics.canvasRole, 'img');
    assert.match(semantics.canvasLabel ?? '', /mission map/i);
    assert.match(semantics.canvasDescription ?? '', /identity/);
    assert.equal(semantics.hudLabel, 'Mission status and controls');
    assert.equal(semantics.objectiveLive, 'polite');
    assert.equal(semantics.readinessLive, 'polite');
    await page.getByRole('complementary', { name: 'Mission status and controls' }).waitFor();

    const mute = page.locator('#mute');
    await page.evaluate(() => {
      window.__uxKeys = [];
      window.__uxMuteClicks = 0;
      window.addEventListener('keydown', (event) => {
        window.__uxKeys.push({ key: event.key, defaultPrevented: event.defaultPrevented });
      });
      document.querySelector('#mute').addEventListener('click', () => { window.__uxMuteClicks += 1; });
    });
    await mute.focus();
    await page.keyboard.press('Enter');
    assert.equal(await mute.getAttribute('aria-pressed'), 'true', 'Enter activates mute once');
    assert.equal(await page.locator('#ready').isHidden(), true, 'focused Enter does not ready globally');

    const focusedEnter = await page.evaluate(() => ({
      keys: window.__uxKeys,
      clicks: window.__uxMuteClicks,
    }));
    assert.deepEqual(focusedEnter.keys, [{ key: 'Enter', defaultPrevented: false }]);
    assert.equal(focusedEnter.clicks, 1, 'native Enter activation toggles mute exactly once');

    await page.locator('#hud').evaluate((hud) => {
      hud.dataset.phase = 'active';
      const values = {
        identity: 'YOU · P1 · PARTNER · P2 · YOUR ECHO · P1 · PARTNER ECHO · P2',
        phase: 'ACTIVE · ATTEMPT 99',
        objective: 'Open the final door with Echo Presence',
        interaction: '[E] STEAL VAULT DATA',
        'echo-status': 'ECHO REPLAYING · 10 SECONDS BEHIND',
        'guard-status': 'GUARD 51 INVESTIGATING — CROSS WHEN CLEAR',
      };
      for (const [id, value] of Object.entries(values)) {
        const element = document.getElementById(id);
        element.textContent = value;
        element.hidden = false;
      }
      const steps = document.querySelector('#mission-steps');
      steps.replaceChildren(...[
        'Steal the vault data',
        'Open the final door with Echo Presence',
        'Reach extraction together (1/2)',
      ].map((label) => Object.assign(document.createElement('li'), { textContent: label })));
      for (const selector of ['#ready', '#restart']) document.querySelector(selector).hidden = false;
    });
    assert.equal(await page.locator('#briefing').getAttribute('hidden'), null,
      'briefing lifecycle is owned solely by the HUD data phase');
    assert.equal(await page.locator('#briefing').isHidden(), true, 'briefing collapses during ACTIVE');
    const layout = await page.evaluate(() => {
      const selectors = [
        '#hud', '#mute', '#identity', '#phase', '#objective', '#mission-steps', '#interaction',
        '#echo-status', '#guard-status', '#controls',
      ];
      const boxes = Object.fromEntries(selectors.map((selector) => [
        selector, document.querySelector(selector).getBoundingClientRect(),
      ]));
      return {
        boxes,
        overflowY: getComputedStyle(document.querySelector('#hud')).overflowY,
        transition: getComputedStyle(document.querySelector('#hud')).transitionDuration,
      };
    });
    for (const [selector, box] of Object.entries(layout.boxes)) {
      assert(box.width > 0 && box.height > 0, `${selector} is visible at ${viewport.width}x${viewport.height}`);
      assert(box.top >= 0 && box.left >= 0, `element starts in ${viewport.width}x${viewport.height}`);
      assert(box.right <= viewport.width && box.bottom <= viewport.height,
        `element fits ${viewport.width}x${viewport.height}`);
    }
    const vertical = [
      '#identity', '#phase', '#objective', '#mission-steps', '#interaction', '#echo-status',
      '#guard-status', '#controls',
    ].map((selector) => [selector, layout.boxes[selector]]);
    for (let index = 1; index < vertical.length; index += 1) {
      const [previousSelector, previous] = vertical[index - 1];
      const [selector, current] = vertical[index];
      assert(previous.bottom <= current.top,
        `${previousSelector} does not overlap ${selector} at ${viewport.width}x${viewport.height}`);
    }
    assert.equal(layout.overflowY, 'auto', 'short lobby and terminal HUDs remain scrollable');
    assert.equal(layout.transition, '0s', 'reduced motion disables HUD transitions');
    await page.locator('#hud').evaluate((hud) => { hud.dataset.phase = 'won'; });
    assert.equal(await page.locator('#briefing').isVisible(), true, 'briefing returns in terminal state');
    await page.close();
  }
  console.log('Containerized Chromium browser UX passed at 1280x720 and 800x600');
} finally {
  await browser.close();
  await server.close();
}
