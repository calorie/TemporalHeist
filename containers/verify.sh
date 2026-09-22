#!/bin/sh
set -eu

sh containers/codegen.sh
git diff --exit-code -- apps/web/src/generated/temporal_heist.ts
sh spikes/protocol/check.sh
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npx tsc -p apps/web/tsconfig.json
npx biome check apps/web/src
node apps/web/test/timeline.mjs
npx vite build apps/web
