import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { captureScreenshot } from './screenshot.mjs';

const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent('<style>body{margin:0;background:rgb(4,9,14)}</style>');
  // Both flat frames pass the old opaque/nonblack pixel condition.
  for (const color of [[4, 9, 14], [9, 23, 31]]) {
    assert.equal([...color, 255][3], 255);
    assert(color.some((channel) => channel > 0));
    await page.evaluate((color) => { document.body.style.background = `rgb(${color})`; }, color);
    await assert.rejects(captureScreenshot(page), /screenshot.*(floor|wall|guard)/);
  }
  // A floor and wall without the guard is also insufficient.
  await page.setContent('<style>body{margin:0;background:rgb(9,23,31)}div{position:absolute;left:792px;top:590px;width:20px;height:30px;background:rgb(31,64,79)}</style><div></div>');
  await assert.rejects(captureScreenshot(page), /screenshot.*guard/);
  await page.evaluate(() => {
    const guard = document.createElement('div');
    guard.style.cssText = 'left:900px;top:300px;width:19px;height:46px;background:rgb(242,184,41)';
    document.body.append(guard);
  });
  const samples = await captureScreenshot(page);
  assert.deepEqual(samples.floor, [9, 23, 31, 255]);
  assert.deepEqual(samples.wall, [31, 64, 79, 255]);
  assert.deepEqual(samples.guard.color, [242, 184, 41]);
  await assert.rejects(captureScreenshot(page, undefined, false), /screenshot.*objective/);
  await page.evaluate(() => {
    const objective = document.createElement('div');
    objective.id = 'objective';
    objective.style.cssText = 'left:1072px;top:332px;width:23px;height:56px;background:rgb(20,230,255)';
    document.body.append(objective);
  });
  assert.deepEqual((await captureScreenshot(page, undefined, false)).objective, [20, 230, 255, 255]);
  await assert.rejects(captureScreenshot(page, undefined, true), /screenshot.*objective/);
  await page.evaluate(() => { document.querySelector('#objective').style.background = 'rgb(26,77,87)'; });
  assert.deepEqual((await captureScreenshot(page, undefined, true)).objective, [26, 77, 87, 255]);
  await assert.rejects(captureScreenshot(page, undefined, false), /screenshot.*objective/);
  console.log('screenshot regressions reject clear color, flat floor, missing guard, and incorrect objective state');
} finally {
  await browser.close();
}
