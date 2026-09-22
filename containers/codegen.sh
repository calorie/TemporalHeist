#!/bin/sh
set -eu
mkdir -p apps/web/src/generated
protoc -I proto --plugin=protoc-gen-ts_proto=node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=apps/web/src/generated \
  --ts_proto_opt=forceLong=number,esModuleInterop=true proto/temporal_heist.proto
