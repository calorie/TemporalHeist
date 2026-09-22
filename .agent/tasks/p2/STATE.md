# P2 state

## Status

The P2 protocol and authored map contract are frozen and container-verified.
Guard simulation, canonical client presentation, raw WebGPU geometry, HUD, and
audio are integrated. Two-client gameplay acceptance passes. Release verification
still needs the cube-mesh visual follow-up and two-stack isolation.

## Completed

- Selected an authority-owned Patrol → Investigate → Return guard state machine.
- Defined live-human failure and non-failing Echo investigation semantics.
- Preserved the exact 600-tick, one-generation canonical Echo model.
- Defined the contract-first and container-only verification boundaries.
- Added additive protocol-major-1 fields: `Snapshot.guards = 12` and
  `RoomState.failure_guard_id = 11`.
- Added `FailureReason.GUARD = 3`, `GuardState` values Unspecified/Patrol/
  Investigate/Return = 0/1/2/3, and the `Guard`/`GuardTarget` messages.
- Authored guard 51 with waypoints 511 then 512 and the guarded-passage rectangle,
  and regenerated the TypeScript bindings from the protobuf source.
- Added a Rust-to-TypeScript protocol spike covering all three operational guard
  states, optional investigation target presence, guard failure diagnostics, and
  legacy snapshots that omit field 12.
- Updated existing Rust snapshot construction for additive compatibility.
- Added checked-in-map guard parsing and validation, integer patrol movement and
  view-cone detection, Echo investigation/search/return, snapshot publication,
  and full attempt reset.
- Added focused guard tests covering patrol clamping, Echo selection and search,
  deterministic return, live-human failure priority, phase freeze, reset, map
  validation, cone boundaries, and missing-target recovery.
- Added stable-ID guard timeline interpolation, legacy/unknown-state fallbacks,
  guard geometry and state colors, the visible crossing cue and guard failure
  explanation, and a synthesized investigation cue.
- Added direct guard failure/reset, timed live decoy recording, exact-delay Echo
  lure, safe guarded-passage crossing, final guard agreement, GPU cone readback,
  and visible two-client evidence to the existing door/extraction acceptance.
- Fixed blank browser captures by retaining the Vulkan surface; every E2E and
  visual screenshot now checks an actual captured scene pixel. Visual metadata
  includes canonical guards and the visible guard HUD.

## Verification

All commands ran in the isolated `p2-contract` container namespace.

- `sh container p2-contract build dev` — passed.
- `sh container p2-contract run --rm dev npm ci` — passed; 41 packages installed,
  0 vulnerabilities.
- `sh container p2-contract run --rm dev sh containers/codegen.sh` — passed.
- `sh container p2-contract run --rm dev sh spikes/protocol/check.sh` — passed;
  Rust/TypeScript guard round-trip and absent-field compatibility assertions passed.
- `sh container p2-contract run --rm dev cargo fmt --all --check` — passed.
- `sh container p2-contract run --rm dev cargo fmt --manifest-path spikes/protocol/Cargo.toml -- --check` — passed.
- `sh container p2-contract run --rm dev cargo test --workspace` — passed; 25 tests,
  0 failures, plus all doc tests.
- `sh container p2-contract run --rm dev npx tsc -p apps/web/tsconfig.json` — passed.

TDD evidence: before the protobuf production change, the protocol command failed
because generated TypeScript did not export `GuardState`. The first attempt on the
fresh run ID stopped earlier because its isolated Node volume had not yet received
`npm ci`; after installing locked dependencies, the expected missing-contract
failure was observed.

Task 2 used the isolated `p2-sim` container namespace. The first guard test run
failed to compile because `Map.guards`, `World.guards`, and `validate_guards` were
absent. After implementation, a missing-investigation-target test failed with
Investigate instead of Patrol, then passed after the recovery branch was added.
Final checks passed:

- `sh container p2-sim run --rm dev cargo fmt --all --check`
- `sh container p2-sim run --rm dev cargo clippy --workspace --all-targets -- -D warnings`
- `sh container p2-sim run --rm dev cargo test -p th-sim` — 28 passed.

Task 3 used the isolated `p2-web` namespace. Timeline tests first failed because
guard presentation was absent; guard-view tests failed because the module was
absent. Final `sh container p2-web verify` passed codegen/protocol, formatting,
clippy, 25 Rust tests, TypeScript, Biome, all client and container contracts, Vite,
and the SwiftShader WebGPU spike with zero shader/validation errors.

Task 4 used the isolated `p2-render` namespace. HUD, audio, and geometry tests
first failed for absent guard behavior. A later geometry test caught cone
occlusion before its depth fix. The focused HUD/audio/presentation tests,
TypeScript, Biome, `node spikes/gpu/test.mjs`, and final
`sh container p2-render verify` all passed; the backend was SwiftShader with zero
shader/validation errors.

The integrated quality fixes passed `sh container p2-quality verify`, including
29 simulation tests and the reordered-two-guard timeline regression.

Task 5 uses the private `p2-e2e` Compose namespace. The new visual-metadata
behavior test first failed because captures omitted canonical guards; after the
capture change it passed in the browser container. The first gameplay run failed
at the Echo-lure assertion before the patrol-timed route was adjusted. Subsequent
runs exposed doorway overshoot, screenshot latency during the investigation
window, and an extraction waiting point still inside guard range; the harness
was corrected without changing gameplay, protocol, or map data.

A captured-image regression then failed with transparent `[0,0,0,0]` where GPU
readback returned `[4,9,14,255]`. Removing only `--disable-vulkan-surface` from the
E2E and visual browser launches made the actual PNG match `[4,9,14,255]`.

- `sh container p2-e2e verify` — passed: codegen/protocol, format/clippy, 37 Rust
  tests (8 authority and 29 simulation), TypeScript/Biome, all client/container
  contracts, Vite, and the SwiftShader WebGPU spike with zero shader/validation
  errors. The compositor reported Mesa llvmpipe Vulkan.
- `sh container p2-e2e acceptance` — passed. Guard 51 caught the live player and
  reset to its initial state; the observed lure at tick 10179 had source tick
  9579 (exactly 600 behind). B crossed at tick 10257 while the guard still
  investigated and the room remained ACTIVE. Both clients won at tick 12379
  with identical room/guard state. Existing three-door, surveillance, and reset
  checks also passed. Patrol/investigation cone readbacks were `[15,80,80,255]`
  and `[164,17,13,255]`. All 14 screenshots contained an opaque scene; both
  browser and renderer error arrays were empty.
- `sh container p2-e2e visual` — passed for two independent Chromium services,
  profiles, and ephemeral CDP ports. Both visual metadata files contained the
  same initial guard 51 snapshot and empty error arrays. Captured investigation
  images visibly show the red cone and `GUARD 51 INVESTIGATING — CROSS NOW`.
  Handoff artifacts are preserved under the Task 5 checkout's untracked
  `.superpowers/sdd/p2/artifacts/` directory.

Task 5 review fix 1 replaced the state/entry-tick-only investigation check with
complete guard comparison at a shared canonical tick. A regression first showed
that the old validation accepted a divergent X coordinate. The new guard
agreement and existing visual-browser contract checks passed in the `p2-e2e`
browser container, and `sh container p2-e2e acceptance` passed again. Both complete
guard snapshots are retained at tick 10242 in the investigation event's
`agreement` field; both clients won at tick 12395 with empty browser/renderer
error arrays. The guard-agreement regression is registered in standard verify.

## Blockers

Visual inspection now exposes a pre-existing cube-mesh defect: floor/wall/body
boxes appear as diagonal half-rectangles. The primary agent confirmed the finding
and assigned a dedicated renderer follow-up. The protocol, map, and renderer
geometry were not changed by Task 5.

The frozen `RoomState` publishes the guard failure reason and guard ID but has no
guard-detected-player field. The approved design requires reason and guard ID;
the task brief's detected-player phrase is a non-blocking plan overreach.

## Next action

Complete the cube-mesh visual follow-up and release two-stack isolation before
requesting integration approval.
