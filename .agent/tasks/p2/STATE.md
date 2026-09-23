# P2 state

## Status

Final-review corrections are being verified in the exclusive `p2-final-fixes`
checkout. The original `b35349d` release evidence below is superseded and retained
only as history: it did not prove a mandatory geometric crossing, robust lure
assertions, scene-specific screenshots, or radial cone parity. The serialized
map correction and exact coordinates are recorded in `DECISIONS.md`.

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

## Review observations

The prior cube-mesh defect is fixed by `c928f92` and its strengthened regression
by `b35349d`. The integrated visual images show filled rectangular floor, wall,
and guard bodies. The guard's formerly triangular far corners were a rendering
defect, corrected by the final-review radial clip. Both the original acceptance and
visual screenshots contain opaque, nonblack scene pixels after removing
`--disable-vulkan-surface` from the browser launches.

The frozen `RoomState` publishes the guard failure reason and guard ID but has no
guard-detected-player field. The approved design requires reason and guard ID;
the task brief's detected-player phrase is a non-blocking plan overreach.

The original two deferred reviewer minors were: the E2E lure check accepted a
180 mm target/Echo offset but also requires exact X equality; this passed in the
final run (both X values were 21397 mm) yet is stricter than the stated tolerance.
The generic screenshot check samples one floor pixel `(640, 650)`; all 14 final
acceptance captures passed with `[9,23,31,255]`, and manual inspection of both
players' lobby and investigation images separately verified the wall, floor,
guard body, cones, and HUD. The single sample alone does not prove the whole
frame is correct.

## Next action

Hand off the verified branch for independent review and PR preparation. The
default branch remains the explicit approval boundary for integration.

## Cube mesh repair verification (`p2-cube` namespace)

- `sh container p2-cube run --rm dev node apps/web/test/cube-mesh.mjs` — failed
  before the source fix with `107 !== 108`, then passed after the fix.
- `sh container p2-cube verify` — passed, including the cube mesh regression,
  Rust/TypeScript checks, Vite build, and SwiftShader WebGPU with zero errors.
- `sh container p2-cube visual` — passed for both container Chromium players.
- Canvas readbacks found guard-body color at all four rectangle corners plus wall
  and floor colors, proving the repaired mesh fills its rectangles.
- `sh container p2-cube down --volumes --remove-orphans` — passed.
- Review follow-up: degenerate-triangle and edge-sharing face mutations each
  passed the old invariant, then failed as expected before their new assertions.
  The strengthened `sh container p2-cube run --rm dev node apps/web/test/cube-mesh.mjs`
  passed, and a fresh `sh container p2-cube verify` passed.
  `sh container p2-cube down --volumes --remove-orphans` passed afterward.

The cube-only branch still used the older `--disable-vulkan-surface` flag and
therefore produced black canvas screenshots. Task 5 independently removed that
flag and proved opaque, visible WebGPU scenes. The final integrated acceptance
and visual images verified both fixes together.

## Historical integrated release verification (`b35349d`, superseded)

- `sh container p2-final verify` — passed: generated TypeScript matches the
  protobuf source, Rust↔TypeScript guard protocol/legacy compatibility, rustfmt,
  Clippy with warnings denied, 8 authority and 29 simulation tests, TypeScript,
  Biome, client and container contracts including cube coverage and complete
  guard agreement, Vite production build, and Chromium WebGPU/WGSL with zero
  shader and validation errors. Chromium 153.0.8010.12 used the SwiftShader
  WebGPU fallback adapter (`vendor: google`, `architecture: swiftshader`); the
  compositor reported ANGLE/Mesa llvmpipe Vulkan 1.4.318, Mesa 25.2.8.
- `sh container p2-final acceptance` — passed from a clean release runtime
  stack. Guard 51 failed a live human at tick 4300 with reason 3 and guard ID 51,
  then restart restored its initial Patrol snapshot. A's Echo at authority tick
  10125 sampled source tick 9525, exactly 600 ticks behind. Its target was
  `(21397,3223)` mm. Both clients' complete guard snapshots matched at shared
  epoch/tick 10125. B occupied the guarded passage at `(18947,4696)` mm and
  exited at tick 10191 while guard 51 remained in Investigate and the room
  remained active. Both players won attempt 2 at tick 12290. Patrol and
  investigation cone readbacks were `[15,80,80,255]` and `[164,17,14,255]`.
  Fourteen PNG screenshots passed opaque/nonblack scene checks; both browser
  and renderer error arrays were empty. Both clients reported WebGPU SwiftShader.
- Acceptance evidence and 14 PNGs were copied from the private `artifacts`
  volume before `sh container p2-final down --volumes --remove-orphans` passed.
  The ignored handoff directory is `.superpowers/sdd/p2/artifacts/p2-final/`.
- `sh container p2-visual visual` — passed with separate persistent Chromium
  profiles and ephemeral CDP ports 52254 (A) and 52253 (B). Both metadata files
  recorded the same initial guard 51 snapshot, WebGPU SwiftShader backend,
  1280×720 viewports, and empty error arrays. Both PNGs visibly contain filled
  rectangular world and guard geometry and a teal guard cone. The images and
  metadata were copied to ignored `.superpowers/sdd/p2/artifacts/p2-visual/`
  before `sh container p2-visual down --volumes --remove-orphans` passed.
- `sh containers/verify-two-stack-isolation.sh
  /Users/a/TemporalHeist/.worktrees/p2-isolation-a p2-isolation-a
  /Users/a/TemporalHeist/.worktrees/p2-isolation-b p2-isolation-b
  /tmp/temporal-heist-p2-isolation` — passed from two clean detached worktrees
  at exact integrated code revision `b35349d0c143ee10dba623e0fdbe26cdaa5e358b`.
  Both acceptance exits were zero, with 14 screenshots each. Both browser
  services were live together; the four observed container IDs per project,
  network IDs, and artifact volumes were disjoint, and no host ports were
  published. Removing A with volumes preserved every recorded B container,
  network, and volume ID, and B's in-network web health check passed. The
  harness cleaned both stacks; both disposable worktrees were removed.
  JSON and acceptance logs remain at `/tmp/temporal-heist-p2-isolation/`.
- `git diff --check` — passed after the documentation edits.

## Final-review correction verification (`p2-final-fix`)

All four regressions were observed failing before their fixes:

- Live collision crossed the old side lane at Z 250. The corrected map test
  checks every integral Z in both exterior lanes, plus the central opening and
  unchanged final puzzle coordinates.
- The old lure assertion rejected a valid 12-tick/720 mm offset. Elapsed-tick
  and 40-tick observation-window cases now pass; impossible displacement and
  incorrect Echo delay are rejected.
- The old capture check accepted a real Chromium PNG containing only opaque
  clear color. Clear-only, floor-only, and missing-guard images are now rejected;
  a synthetic floor/wall/body fixture passes.
- Real WebGPU returned cone color at offset `(2500,1200)`, where authority
  rejects radial range. It now returns floor `[9,23,31,255]`, while `(2200,1000)`
  remains teal `[15,80,80,255]`. Matching Rust assertions also pass.

`sh container p2-final-fix verify` passed: protocol/codegen, rustfmt, Clippy,
8 authority and 30 simulation tests, TypeScript/Biome, client/container
contracts, all new regression checks, Vite, and SwiftShader WebGPU with zero
shader/validation errors. The first acceptance rejected both side bypasses but
timed out on the new lure; its recorded poses identified a narrow timing margin.
The corrected recording route starts earlier and reaches Z 3800, as documented
in `DECISIONS.md`. Final revision release verification is still pending.
