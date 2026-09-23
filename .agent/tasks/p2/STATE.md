# P2 state

## Status

Final-review code revision `d2f1a59fdc2c2e28ea828fa42c6ea04f833bb6a4` passed
full verification, clean acceptance, separate visual verification, and concurrent
acceptance in two clean worktrees. All four final-review findings are addressed.
All test namespaces, their writable state, and both disposable worktrees have
been removed after evidence copy. The owner checkout and untracked evidence
remain for review; default-branch integration still requires user approval.

The original `b35349d` evidence and intermediate `1f92349`/`ac847cf` runs below
are superseded historical evidence. Isolation found two harness timing faults
in the intermediate revisions; both are resolved and all final commands passed
at `d2f1a59`. The serialized map correction and exact coordinates are recorded
in `DECISIONS.md`. The authoritative final evidence is the last section below.

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
in `DECISIONS.md`.

### Candidate revision `1f92349a4a3978b3f3e609353f3e811d5bde7b23` (superseded)

- `sh container p2-final-fix verify` — passed again at the committed revision,
  including all checks above. Chromium 153.0.8010.12 used SwiftShader WebGPU;
  the compositor was ANGLE/Mesa llvmpipe Vulkan 1.4.318, Mesa 25.2.8.
- `sh container p2-final-fix down --volumes --remove-orphans` followed by
  `sh container p2-final-fix acceptance` — passed from clean runtime volumes.
  The south bypass stopped at `(17818,5985)` on tick 9345; the north bypass
  stopped at `(17846,2200)` on tick 9348, both during Patrol and before the lure.
  Guard 51 entered Investigate at tick 10025. Both clients' complete guard
  snapshots matched at tick 10026; A's Echo source tick was 9426 (exactly 600
  behind). B crossed at tick 10089 after occupying `(18162,4149)` in the
  passage; A crossed at tick 10110 after occupying `(18281,4233)`. Both crossings
  remained ACTIVE/Investigate. Both players won at tick 11957 with two live
  extraction occupants. Surveillance and reset checks also passed.
- All 14 clean acceptance PNGs passed known floor `[9,23,31,255]`, wall
  `[31,64,79,255]`, and separate solid guard-body checks. Patrol and investigation
  cone pixels were `[15,80,80,255]` and `[164,17,14,255]`. Browser and renderer
  errors were empty for both players.
- `sh container p2-final-fix-visual visual` — passed for separate browser
  services/profiles with ephemeral CDP ports 52728 and 52729. Both metadata
  files reported the initial guard 51 snapshot, SwiftShader, and empty errors.
  Both saved lobby images, both clean investigation images, the clean win
  image, and the radial GPU image were inspected: floor/wall/guard rectangles,
  the central choke, rounded guard cone boundary, investigation cue, and
  extraction result are visible.
- Clean acceptance and visual artifacts were copied before both namespaces
  were removed with `down --volumes --remove-orphans`. Untracked evidence is
  under `.superpowers/sdd/p2/artifacts/clean-acceptance`, `visual`, and
  `guard-cone-p2-final-fix`; full logs and the report are alongside them.

The first isolation run reached bypass rejection and the exact Echo lure, then
stack A's investigation cone probe read floor at a pixel chosen using a stale
facing. The target was still updating within its 30-tick observation window.
Stack B was stopped and both stacks were removed with volumes. The final
harness now waits until `serverTick >= stateEnteredTick + 30` before this visual
readback; both live crossings continue concurrently. This changes no gameplay
or renderer logic. The failure JSON and logs are retained in `initial-isolation`.
Two clean worktrees were advanced to `ac847cf` for the next rerun.

### Candidate revision `ac847cffd1761c5537756515437d659400d166dc` (superseded)

- `sh container p2-final-fix verify` — passed all protocol/codegen, format,
  Clippy, 8 authority + 30 simulation tests, TS/Biome, client/container
  contracts, Vite, screenshot/lure regressions, actual guard-cone GPU parity,
  and raw WebGPU/WGSL checks. Shader, renderer and browser errors were empty.
- Map consumers are validated against walls 107/108 at X `18100..18500`,
  Z `0..3300`/`4700..8000`, and the passage X `18100..18500`, Z `3300..4700`.
  Guard 51/waypoints 511/512, plate 23 `(19500,2500)`, door 13 and extraction
  are unchanged; deterministic collision and release acceptance cover them.
- `sh container p2-final-fix acceptance` — passed with fresh runtime state and
  browser profiles after the prior namespace/volumes were removed. South/north
  bypasses stopped at X 17792/17816 on tick 9435. At tick 10116 A's Echo used
  source tick 9516, exactly 600 behind; complete guard snapshots agreed across
  clients. B crossed at 10185 after occupying `(18392,4233)` in the passage;
  A crossed at 10200 after occupying `(18164,4278)`. Both crossings remained
  ACTIVE/Investigate. Both won at 12023; surveillance/reset also passed.
- All 14 PNGs passed separate floor, wall and guard-body checks; both browser
  and renderer error arrays were empty. Investigation readback now waits for
  the authoritative target-update window to close, and its red cone check passed.
- `sh container p2-final-fix-visual visual` — passed on separate browser
  services/profiles and ephemeral CDP 52877/52876, with the same initial guard
  metadata and empty errors. Both final investigation and both visual lobby
  images were inspected. The copied radial GPU image shows the clipped arc;
  its inner/far-corner readbacks remain teal/floor respectively.
- Backend remains Chromium 153.0.8010.12, SwiftShader WebGPU, and Mesa
  llvmpipe Vulkan compositor. All final artifacts were copied before the main
  and visual stacks were removed with `down --volumes --remove-orphans`.

Isolation at `ac847cf` passed the probe and both guarded crossings. Stack A
then reached the closed final door after waiting for a second patrol window;
it was caught at 12572, more than 600 ticks after the Echo door observation at
11811. Stack B was stopped, both stacks were removed, and failure evidence was
retained in `extraction-window-failure`. The `d2f1a59` harness now stages both
players off plate 23 and takes one westbound Patrol window to extract together.
Final isolation subsequently passed from clean worktrees at that revision.

### Final verified revision `d2f1a59fdc2c2e28ea828fa42c6ea04f833bb6a4`

- `sh container p2-final-fix verify` — passed protocol/codegen, rustfmt,
  Clippy, 8 authority + 30 simulation tests, TypeScript/Biome, client/container
  contracts, screenshot/lure regressions, real guard-cone GPU parity, Vite, and
  raw WebGPU/WGSL checks. Shader, renderer, and browser errors were empty.
- The map contract is walls 107/108 at X `18100..18500`, respectively
  Z `0..3300`/`4700..8000`, with passage Z `3300..4700`. The deterministic
  regression drives live collision at every integral Z in both side lanes.
  Guard 51, waypoints 511/512, plate 23 `(19500,2500)`, door 13, and extraction
  remain unchanged. All consumers build/test against this map; acceptance
  traverses its opening and completes the original plate/door/extraction puzzle.
- `sh container p2-final-fix acceptance` — passed from fresh runtime volumes
  and browser profiles. South/north bypasses stopped at `(17808,5972)` and
  `(17824,2199)` at tick 9429 during Patrol, before the decoy recording.
  Investigate began at 10111; both clients agreed at 10113, with Echo source
  tick 9513 (exactly 600 behind) and target `(16360,3399)`. B occupied passage
  `(18180,4094)` and crossed at 10188; A occupied `(18411,4205)` and crossed
  at 10200. Both remained ACTIVE/Investigate. At 11922, plate 23 had zero live
  and one Echo Presence, guard X 19160 faced west, and both took the same final
  door window. Both won at 11988 with two live extraction occupants.
  Surveillance failure, guard failure, and reset checks also passed.
- All 14 acceptance PNGs passed distinct floor `[9,23,31,255]`, wall
  `[31,64,79,255]`, and guard-body checks. Patrol/investigation cone samples
  were `[15,80,80,255]`/`[164,17,14,255]`. GPU parity sampled inner offset
  `(2200,1000)` as teal and far corner `(2500,1200)` plus outside angle
  `(2000,1200)` as floor. Both browser and renderer error arrays were empty.
- `sh container p2-final-fix-visual visual` — passed with separate browser
  services/profiles and ephemeral CDP 53150/53149. Both metadata files reported
  the initial guard snapshot and empty errors. Final investigation, won, lobby,
  and focused GPU images were inspected: geometry, the choke, the rounded cone
  boundary, investigation cue, and extraction result were present.
- `sh containers/verify-two-stack-isolation.sh
  /Users/a/TemporalHeist/.worktrees/p2-final-fix-a p2-final-fix-a
  /Users/a/TemporalHeist/.worktrees/p2-final-fix-b p2-final-fix-b
  /tmp/temporal-heist-p2-final-fix-isolation` — passed with both clean worktree
  heads exactly `d2f1a59`. Both browser stacks were observed live, published no
  ports, and used disjoint containers, networks, and artifacts volumes. Both
  acceptances exited 0. A's lure/source ticks were 10242/9642; A/B crossed at
  10329/10332 and won at 11891. B's lure/source ticks were 24594/23994; A/B
  crossed at 24669/24663 and won at 26509. Each checked 14 PNGs with empty
  browser/renderer errors. Removing A with its volumes preserved B's resource
  IDs and health; both stacks were then torn down and worktrees removed.
- Backend: Chromium 153.0.8010.12, SwiftShader WebGPU (`rgba8unorm`),
  ANGLE/Mesa llvmpipe Vulkan 1.4.318, Mesa 25.2.8. This proves container
  software-GPU behavior; it does not claim a physical-GPU run.
- Copied final evidence is untracked under `.superpowers/sdd/p2/artifacts/`:
  `p2-final-fix-release-*`, `clean-acceptance/`, `visual/`,
  `guard-cone-p2-final-fix/`, `component-gpu/`, `isolation/`, and `cleanup.log`.
  The report is `.superpowers/sdd/p2/final-fix-report.md`. Four correctly
  prefixed Compose labels (`th-p2-final-fix`, `th-p2-final-fix-visual`,
  `th-p2-final-fix-a`, `th-p2-final-fix-b`) were checked for zero remaining
  containers/networks/volumes, and all four private Buildx directories were
  removed. Only immutable build images/cache remain shared.

The final evidence commit changes only this state file and `DECISIONS.md`;
all runnable code remains exactly the revision verified above.
