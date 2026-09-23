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
    await mute.focus();
    await page.keyboard.press('Enter');
    assert.equal(await mute.getAttribute('aria-pressed'), 'true', 'Enter activates mute once');
    assert.equal(await page.locator('#ready').isHidden(), true, 'focused Enter does not ready globally');

    await page.locator('#hud').evaluate((hud) => { hud.dataset.phase = 'active'; });
    assert.equal(await page.locator('#briefing').isHidden(), true, 'briefing collapses during ACTIVE');
    const layout = await page.evaluate(() => {
      const hud = document.querySelector('#hud').getBoundingClientRect();
      const objective = document.querySelector('#objective').getBoundingClientRect();
      const steps = document.querySelector('#mission-steps').getBoundingClientRect();
      const mute = document.querySelector('#mute').getBoundingClientRect();
      return {
        hud, objective, steps, mute,
        overflowY: getComputedStyle(document.querySelector('#hud')).overflowY,
        transition: getComputedStyle(document.querySelector('#hud')).transitionDuration,
      };
    });
    for (const box of [layout.hud, layout.objective, layout.steps, layout.mute]) {
      assert(box.top >= 0 && box.left >= 0, `element starts in ${viewport.width}x${viewport.height}`);
      assert(box.right <= viewport.width && box.bottom <= viewport.height,
        `element fits ${viewport.width}x${viewport.height}`);
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
