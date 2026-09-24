import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [wrapper, compose, dockerfile, nginx, visualEntrypoint] = await Promise.all([
  readFile('container', 'utf8'),
  readFile('compose.yaml', 'utf8'),
  readFile('containers/Runtime.Dockerfile', 'utf8'),
  readFile('containers/nginx.conf', 'utf8'),
  readFile('containers/visual-entrypoint.sh', 'utf8').catch(() => ''),
]);

assert.match(wrapper, /release-build\)/);
assert.match(wrapper, /release-inspect\)/);
assert.match(wrapper, /SOURCE_DATE_EPOCH/);
assert.match(wrapper, /TH_RELEASE_REVISION/);
assert.match(wrapper, /TH_RELEASE_VERSION/);
assert.match(wrapper, /TH_RELEASE_CREATED/);

assert.match(compose, /image: temporal-heist-authority:\$\{TH_RELEASE_VERSION/);
assert.match(compose, /image: temporal-heist-web:\$\{TH_RELEASE_VERSION/);
assert.match(compose, /read_only: true/g);
assert.match(compose, /tmpfs:/g);
assert.match(compose, /cap_drop:/g);

for (const label of [
  'org.opencontainers.image.source',
  'org.opencontainers.image.revision',
  'org.opencontainers.image.version',
  'org.opencontainers.image.created',
  'org.opencontainers.image.title',
]) {
  assert.match(dockerfile, new RegExp(label.replaceAll('.', '\\.')));
}
assert.match(dockerfile, /USER 65532:65532/);
assert.match(dockerfile, /USER 101:101/);
assert.doesNotMatch(dockerfile.slice(dockerfile.indexOf(' AS authority\n')), /COPY crates/);
assert.match(nginx, /location = \/healthz/);
assert.match(nginx, /return 200 "ok\\n"/);
assert.match(dockerfile, /x11vnc/);
assert.match(dockerfile, /novnc/);
assert.match(dockerfile, /FROM browser AS visual-browser/);
assert.match(visualEntrypoint, /Xvfb/);
assert.match(visualEntrypoint, /websockify/);
assert.match(compose, /127\.0\.0\.1::6080/);
assert.match(wrapper, /noVNC/);

console.log('release artifact source contract passed');
