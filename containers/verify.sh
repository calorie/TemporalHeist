#!/bin/sh
set -eu

generated_dir=$(mktemp -d)
trap 'rm -rf "$generated_dir"' EXIT
CODEGEN_OUT_DIR="$generated_dir" sh containers/codegen.sh
cmp apps/web/src/generated/temporal_heist.ts "$generated_dir/temporal_heist.ts"
sh spikes/protocol/check.sh
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npx tsc -p apps/web/tsconfig.json
npx biome check apps/web/src
node apps/web/test/timeline.mjs
node apps/web/test/temporal-view.mjs
node apps/web/test/guard-view.mjs
node apps/web/test/cube-mesh.mjs
node apps/web/test/room-hud.mjs
node apps/web/test/player-experience.mjs
node apps/web/test/input-contract.mjs
node apps/web/test/render-cache.mjs
node apps/web/test/objective-view.mjs
node apps/web/test/surveillance-view.mjs
node apps/web/test/audio.mjs
node apps/web/test/presentation-view.mjs
node tests/visual-browser-contract.mjs
node tests/guard-agreement-contract.mjs
node tests/guard-lure-contract.mjs
node tests/screenshot-contract.mjs
node tests/guard-cone-gpu.mjs
node tests/isolation-harness-contract.mjs
node tests/stacked-ci-contract.mjs
npx vite build apps/web
node tests/browser-ux.mjs
node spikes/gpu/test.mjs
