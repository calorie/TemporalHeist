# Project-specific context

## Build / test / lint / typecheck

Every project process runs in containers. From the repository root use a unique
lowercase run ID for every checkout or concurrent run. The stable entry points are:

```sh
sh container <run-id> bootstrap
sh container <run-id> verify
sh container <run-id> acceptance
sh container <run-id> visual
sh containers/verify-two-stack-isolation.sh <worktree-a> <run-a> <worktree-b> <run-b> [evidence-dir]
sh container <run-id> up -d relay authority web
sh container <run-id> --profile test run --rm browser
sh container <run-id> down --volumes --remove-orphans
```

`container` also passes other arguments directly to Compose. It derives the Compose
project, room, Buildx state, network, volumes, browser profiles and artifacts from
the run ID. Only commands recorded as passed in the task `STATE.md` are verification
evidence. The `visual` command starts player A and B as separate Chromium services
with separate persistent profiles and ephemeral CDP ports. Host commands may
orchestrate Docker and Git only.

`verify-two-stack-isolation.sh` is the release-level two-worktree check. It runs the
existing containerized acceptance entry point twice in parallel, observes both
browser services, verifies disjoint Compose resources and no host ports, tears one
project down with volumes, and checks that the other project and its in-network
health remain intact. It writes JSON evidence and acceptance logs outside both
worktrees.

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
