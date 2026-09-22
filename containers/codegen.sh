#!/bin/sh
set -eu
output_dir=${CODEGEN_OUT_DIR:-apps/web/src/generated}
mkdir -p "$output_dir"
protoc -I proto --plugin=protoc-gen-ts_proto=node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out="$output_dir" \
  --ts_proto_opt=forceLong=number,esModuleInterop=true proto/temporal_heist.proto
