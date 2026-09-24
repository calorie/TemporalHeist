import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const wrapper = await readFile('container', 'utf8');
const indexer = await readFile('containers/evidence-index.mjs', 'utf8');
const releaseCase = wrapper.slice(wrapper.indexOf('\n  release-evidence)'), wrapper.indexOf('\n  two-stack-isolation)'));

const createHostDir = releaseCase.indexOf('mkdir -p "$evidence_dir"');
const resetHost = releaseCase.indexOf('find "$TH_EVIDENCE_DIR" -mindepth 1 -delete');
const resetVolume = releaseCase.indexOf('find /artifacts -mindepth 1 -delete');
const firstReleaseStep = releaseCase.indexOf('release-build');
const cleanCheck = releaseCase.lastIndexOf('require_clean_release_context');
assert(createHostDir >= 0 && createHostDir < resetHost,
  'the host runner must own the evidence directory before a container clears its contents');
assert(resetHost >= 0 && resetHost < firstReleaseStep, 'stale host evidence contents must be cleared first');
assert(resetVolume >= 0 && resetVolume < firstReleaseStep, 'stale volume evidence must be cleared first');
assert(resetHost < cleanCheck && resetVolume < cleanCheck,
  'even a dirty-context failure must not retain an earlier passed index');
assert.doesNotMatch(releaseCase, /rm -rf "\/workspace\/\.release\/\$TH_AGENT_ID"/,
  'a root container must not replace the host-owned bind mount directory');

const strictExport = releaseCase.indexOf('strict_release_export');
const buildIndex = releaseCase.lastIndexOf('evidence-index.mjs');
const markComplete = releaseCase.lastIndexOf('evidence_complete=1');
assert(strictExport >= 0 && strictExport < buildIndex && buildIndex < markComplete,
  'export, index, and passed-completion ordering is required');
assert.match(releaseCase, /if \[ "\$evidence_complete" -eq 0 \]; then[\s\S]*rm -f .*index\.json/,
  'an interrupted rerun removes any passed index');

assert.match(indexer, /const artifactRoot = `\$\{outputDir\}\/artifacts`/);
assert.doesNotMatch(indexer, /filesUnder\('\/artifacts'\)/,
  'the index must describe the exported upload tree');

console.log('Release evidence rerun/failure contract passed');
