import assert from 'node:assert/strict';

const deadline = Date.now() + 30_000;
let targets;
while (Date.now() < deadline) {
  try {
    const response = await fetch('http://127.0.0.1:9222/json/list');
    if (response.ok) targets = await response.json();
  } catch {}
  if (targets?.some((target) => target.url.startsWith('http://web:5173/'))) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}

assert(targets?.some((target) => target.url.startsWith('http://web:5173/')),
  'container Chromium did not expose the game target over CDP');
console.log('Container Chromium CDP target is ready');
