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
npx vite build apps/web
