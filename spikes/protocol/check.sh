#!/bin/sh
set -eu
mkdir -p spikes/protocol/generated
protoc --plugin=protoc-gen-ts_proto=node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=spikes/protocol/generated \
  --ts_proto_opt=forceLong=number,esModuleInterop=true proto/temporal_heist.proto
npx tsc spikes/protocol/generated/proto/temporal_heist.ts --outDir spikes/protocol/compiled \
  --target es2022 --module es2022 --moduleResolution bundler --skipLibCheck
node spikes/protocol/check.mjs encode
cargo run --manifest-path spikes/protocol/Cargo.toml
node spikes/protocol/check.mjs decode
