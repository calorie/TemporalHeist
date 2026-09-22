# Project-specific context

## Build / test / lint / typecheck

Every project process runs in containers. From the repository root use a unique
lowercase run ID for every checkout or concurrent run:

```sh
sh container <run-id> build dev
sh container <run-id> run --rm dev npm ci
sh container <run-id> run --rm dev sh containers/codegen.sh
sh container <run-id> run --rm dev sh spikes/protocol/check.sh
sh container <run-id> run --rm dev cargo fmt --all --check
sh container <run-id> run --rm dev cargo clippy --workspace --all-targets -- -D warnings
sh container <run-id> run --rm dev cargo test --workspace
sh container <run-id> run --rm dev npx tsc -p apps/web/tsconfig.json
sh container <run-id> run --rm dev npx biome check apps/web/src
sh container <run-id> run --rm dev node spikes/gpu/test.mjs
sh container <run-id> down --volumes --remove-orphans
```

Full game/E2E entry points are added and verified by the active vertical-slice task.
Only commands recorded as passed in `.agent/tasks/vertical-slice/STATE.md` are
verification evidence. Host commands may orchestrate Docker and Git only.

## Dependency / toolchain

- Rust stable 1.98.1, edition 2024; Node/npm from Playwright 1.63.0 Noble image.
- TypeScript 7.0.2, Vite 8.3.0, Playwright 1.63.0, Biome 2.5.14.
- Protocol: protobuf, prost/prost-build 0.14.4, ts-proto 2.12.4.
- MoQ: `@moq/net` 0.3.5, `moq-net` 0.2.22, `moq-native` 0.19.19,
  `moq-relay` 0.14.18; verified `moq-lite-05` over browser WebTransport.
- Raw WebGPU/WGSL in full containerized Chromium. Software validation uses
  SwiftShader WebGPU with Mesa llvmpipe/Vulkan compositor.

## Architecture invariants

- Rust authority owns gameplay, fixed 60 Hz canonical `(room_epoch, server_tick)`.
- Exactly two P0 players; one Echo generation at exactly 600 ticks (10 seconds).
- Echoes use committed human pose history, ignore current collision, and never
  create source history. Authority alone evaluates None/Presence/Action effects.
- World state never rewinds. Renderer output never feeds authoritative state.
- MoQ is the actual data plane and exists only behind transport adapters.
- Full timeline groups/snapshots are independently decodable. Authority retains
  at least 3601 ticks and provides bounded history bootstrap over MoQ.
- Each writing agent owns an isolated worktree and unique Compose namespace,
  private network, writable volumes/caches, relay, authority, web, browser profiles,
  certificates and artifacts. Automated tests expose no fixed host ports and use
  no `container_name`.

## Generated code / source of truth

- `proto/temporal_heist.proto` is the application protocol source of truth.
  Rust bindings generate during Cargo build; `containers/codegen.sh` writes the
  TypeScript bindings. Generated bindings are never hand-edited.
- `map/facility.json` is the map geometry/mechanism source of truth.
- `docs/CONTRACT_V1.md` is the frozen semantic/component contract. Schema, map,
  generated-code definition and container command changes are synchronization
  boundaries and must be verified before dependent work resumes.

## External constraints

- The complete toolchain, relay, authority, web, Chromium, WebGPU and all tests
  run inside OCI containers. CI invokes the same `container` wrapper.
- Browser WebTransport uses the relay's generated certificate fingerprint in dev.
  Track/subscription retention must be explicit (at least 30 seconds); the library
  default is shorter than the Echo delay. Gameplay correctness never depends on
  relay retention alone.
- Infrastructure files and this document remain English for the contract check.
