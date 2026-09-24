import assert from 'node:assert/strict';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const runId = process.env.TH_AGENT_ID;
const outputDir = process.env.TH_EVIDENCE_DIR ?? `/workspace/.release/${runId}`;
assert.match(runId ?? '', /^[a-z0-9-]+$/);

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function filesUnder(root) {
  const result = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else result.push(file);
    }
  }
  await visit(root);
  return result.sort();
}

const release = await json(`${outputDir}/manifest.json`);
const e2ePath = `/artifacts/e2e-${runId}/evidence.json`;
const rendererPath = `/artifacts/renderer-gpu-${runId}/evidence.json`;
const [e2e, renderer] = await Promise.all([json(e2ePath), json(rendererPath)]);
const soakLog = await readFile(`${outputDir}/soak.log`, 'utf8');
const soakLine = soakLog.split('\n').find((line) => line.includes('SOAK_EVIDENCE '));
assert(soakLine, 'fixed-tick soak evidence is missing');
const soak = JSON.parse(soakLine.slice(soakLine.indexOf('SOAK_EVIDENCE ') + 14));
assert.equal(soak.ticks, 216_000);
assert.equal(soak.players, 2);
assert(e2e.renderers.every(({ backend, adapter }) => backend === 'webgpu' && adapter?.vendor));
assert(e2e.errors.every((errors) => errors.length === 0));
assert(e2e.browserErrors.every((errors) => errors.length === 0));

const artifactFiles = await filesUnder('/artifacts');
const artifactPaths = [];
for (const file of artifactFiles) {
  const info = await stat(file);
  artifactPaths.push({ path: file.replace('/artifacts/', 'artifacts/'), bytes: info.size });
}

const index = {
  schemaVersion: 1,
  result: 'passed',
  runId,
  sourceSha: release.sourceSha,
  version: release.version,
  command: `sh container ${runId} release-evidence`,
  images: release.images.map(({ role, reference, id, repoDigests, size, labels }) =>
    ({ role, reference, id, repoDigests, size, labels })),
  compose: {
    project: `th-${runId}`,
    config: 'compose-config.json',
    resources: 'compose-resources.json',
  },
  verification: {
    releaseSmoke: 'passed',
    acceptance: 'passed',
    runtimeReliability: 'passed',
    browserRecovery: 'passed',
    fixedTickSoak: soak,
  },
  authorityLifecycleLog: 'authority-lifecycle.jsonl',
  epochs: {
    won: e2e.wonSnapshot.roomEpoch,
    final: e2e.finalSnapshot.roomEpoch,
    tickRange: [e2e.events.at(0)?.tick ?? 0, e2e.finalTick],
  },
  resourceMaxima: soak,
  webGpu: e2e.renderers,
  rendererCapacity: renderer.temporal,
  errors: { renderer: e2e.errors, browser: e2e.browserErrors },
  artifacts: artifactPaths,
};

await writeFile(`${outputDir}/index.json`, `${JSON.stringify(index, null, 2)}\n`);
console.log(JSON.stringify({ event: 'release-evidence-indexed', path: `${outputDir}/index.json` }));
