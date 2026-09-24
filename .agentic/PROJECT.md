# Project-specific context

## Build / test / lint / typecheck

Every project process runs in containers. From the repository root use a unique
lowercase run ID for every checkout or concurrent run. The stable entry points are:

```sh
sh container <run-id> bootstrap
sh container <run-id> verify
sh container <run-id> acceptance
sh container <run-id> visual
sh container <run-id> release-build
sh container <run-id> release-inspect
sh container <run-id> release-evidence
sh container <run-id> two-stack-isolation
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

`acceptance` and `visual` build dedicated release/runtime targets: a release Rust
authority, static nginx web server, and browser runner. They do not use the combined
development image or its writable language caches. The relay is the digest-pinned
official `moqdev/moq-relay:0.14.18` image. `verify` alone uses the combined dev image
because its cross-language checks need both toolchains. Always remove a visual stack
after inspection with `sh container <run-id> down --volumes --remove-orphans`.

`two-stack-isolation` creates two clean detached worktrees at the current revision.
It starts two complete visual stacks in parallel, each with relay, authority, web,
Chromium A/B, private profiles, artifacts, network, volumes, and two ephemeral
loopback noVNC ports. It verifies every mutable resource and published port is
disjoint, removes stack A with its volumes, then rechecks stack B's resource IDs,
web health, and both RFB displays. The versioned manifest and logs are written under
`.release/<run-id>/isolation`.

`release-build` requires a clean build context and creates
`temporal-heist-authority:<run-id>-<version>` and
`temporal-heist-web:<run-id>-<version>` from locked sources with OCI provenance
labels. The friendly version remains in the OCI version label.
`release-inspect` writes `.release/<run-id>/manifest.json` with their immutable
config IDs, optional repository digests, sizes, labels, source SHA, and image tag. Set
`TH_RELEASE_VERSION`, `TH_RELEASE_CREATED`, and `SOURCE_DATE_EPOCH` explicitly for
a named release; otherwise metadata is derived reproducibly from the Git commit.
`visual` exposes each live container-owned headed Chromium through a distinct
ephemeral loopback noVNC URL. It verifies Xvfb, x11vnc, websockify, and an RFB
handshake through the noVNC WebSocket before printing URLs.

`release-evidence` is the clean-checkout RC gate. It runs release image inspection
and smoke, the 216,000-tick deterministic two-player soak, raw WebGPU verification,
full mission acceptance, relay/authority recovery, and browser epoch recovery. It
writes `.release/<run-id>/index.json` plus image provenance, Compose metadata,
structured lifecycle logs, WebGPU adapter/backend details, screenshots, and traces.
CI uses the same entry point for release, manual, and weekly scheduled runs and
uploads evidence before removing the isolated stack.

## Dependency / toolchain

- Rust stable 1.98.1, edition 2024; Node/npm from Playwright 1.63.0 Noble image.
- TypeScript 7.0.2, Vite 8.3.0, Playwright 1.63.0, Biome 2.5.14.
- Protocol: protobuf, prost/prost-build 0.14.4, ts-proto 2.12.4.
- MoQ: `@moq/net` 0.3.5, `moq-net` 0.2.22, `moq-native` 0.19.19,
  `moq-relay` 0.14.18; verified `moq-lite-05` over browser WebTransport.
- Raw WebGPU/WGSL in full containerized Chromium. Software validation uses
  SwiftShader WebGPU with Mesa llvmpipe/Vulkan compositor.
- `sh container <run-id> verify` validates the real production renderer in one
  Chromium session at both supported viewports; the retired standalone GPU spike
  is no longer a verification path.
- Full mission acceptance records a `temporal-bridge-agreement` event from the exact
  presentation frame submitted to WebGPU. It matches both clients by canonical tick
  and verifies bridge owner/endpoints/counts against GPU segment, pulse, draw, and
  upload statistics. The read-only browser test API is presentation evidence only.

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
- `sh container <run-id> runtime-reliability` builds the release runtime and verifies
  authority liveness/readiness transitions, relay recovery without epoch replacement,
  authority restart epoch replacement, and bounded SIGTERM shutdown.
- `sh container <run-id> runtime-browser-recovery` verifies two Chromium clients
  recover without reload, resume movement, replace epoch/timeline state, rejoin, and
  ready after relay and authority faults.
- Infrastructure files and this document remain English for the contract check.
- CI runs component verification on every PR and full browser acceptance on
  pushes to `main` and PRs by default. Use the `component-only` label only on
  intermediate stacked PRs whose focused and component checks are sufficient.
  The top or release PR has no `component-only` label and runs full acceptance.
