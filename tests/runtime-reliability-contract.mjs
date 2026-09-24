import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const compose = readFileSync('compose.yaml', 'utf8');
const main = readFileSync('crates/authority/src/main.rs', 'utf8') + readFileSync('crates/authority/src/health.rs', 'utf8');
const transport = readFileSync('apps/web/src/net/moq/transport.ts', 'utf8');
const container = readFileSync('container', 'utf8');

assert.match(compose, /healthcheck:/);
assert.match(compose, /condition: service_healthy/);
assert.match(compose, /RUST_LOG:.*th_authority=info/);
assert.match(main, /\/healthz/);
assert.match(main, /\/readyz/);
assert.match(main, /ctrl_c/);
assert.match(transport, /writeFrame[\s\S]*catch/);
assert.match(transport, /MAX_SNAPSHOT_BYTES\s*=\s*64 \* 1024/);
assert.match(transport, /MAX_HISTORY_BYTES\s*=\s*2 \* 1024 \* 1024/);
assert.match(container, /runtime-reliability[\s\S]*--force-recreate --wait/);
assert.match(container, /runtime-reliability[\s\S]*trap cleanup_runtime_reliability EXIT INT TERM/);
console.log('runtime reliability contract passed');
