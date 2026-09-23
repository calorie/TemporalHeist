# P3 state

## Status

Architectural design is approved. The first stack layer, the additive P3.1
contract/map, is implemented and verified on `p3/contract-map`. Its exact code
revision is `12ea6e87e6361d8b0b74e1fb09bb658012917536`.
The P3.2 authority mission layer is implemented and verified on
`p3/authority-mission`.
The P3.3 client presentation layer is implemented and verified on
`p3/client-presentation`.

## Completed

- Selected a dependent four-layer GitHub PR stack for the full P3 objective.
- Chose one authority-owned team objective rather than inventory or generic loot.
- Chose live-human-only `ACTION` at a vault terminal; Echo Action cannot steal.
- Completed read-only product, contract, client, and E2E audits.
- Wrote the P3 design and stable task acceptance criteria.
- Wrote the detailed contract, authority, client, and full-E2E implementation
  plan with exact container commands and stack boundaries.
- Added `RoomState.objective_secured` field 12 with a legacy `false` default and
  regenerated the TypeScript binding.
- Authored vault objective 61 at `(21000, 4000)` with radius 750 mm and added
  Rust deserialization, bounds/radius/target-ID validation, and browser map type.
- Documented the live-human-only contract and compatibility semantics.
- Added attempt-scoped authority theft state. A connected human's active,
  in-radius action on objective 61 secures it without creating a replayable
  action. Winning now requires theft, Echo-opened final door, and both humans
  in extraction. Restart clears the theft state.
- Added snapshot-driven vault targeting and a cyan/dim WebGPU pedestal. The HUD
  advances theft → Echo final door → team extraction from authoritative room
  fields, keeps guard guidance separate, and plays one cue on the theft edge.
- Updated the briefing to explain that only a live player can steal the data.

## Verification

- Design self-review passed: no placeholders, contradictory ownership, ambiguous
  Echo capability, or scope outside the single mission loop remains.
- Plan self-review passed: every design requirement maps to a task, shared types
  and IDs agree across layers, and the five review-focus cases have owning tests.
- TDD red: `sh container p3-t1-protocol-red run --rm dev sh -lc 'npm ci >/dev/null && sh spikes/protocol/check.sh'` failed with missing Rust `objective_secured` field (E0609, E0560).
- TDD red: `sh container p3-t1-map-red run --rm dev cargo test -p th-sim objective_map_contract -- --exact` failed with missing `Map.objective` field (E0609). The separate objective validation check also failed before implementation because `validate_objective` and `Map.objective` were absent.
- Focused green: `sh container p3-t1-contract run --rm dev cargo test -p th-sim objective_map_contract -- --exact` passed 1 test; `sh container p3-t1-contract run --rm dev cargo test -p th-sim objective_validation` passed 1 test. `sh container p3-t1-contract run --rm dev sh -lc 'npm ci >/dev/null && sh spikes/protocol/check.sh'` passed, including Rust-to-TypeScript `true` and TypeScript-to-Rust absent-field `false` decoding.
- Full green: `sh container p3-t1-contract verify` passed codegen comparison, protocol spike, Rust format and Clippy, 43 Rust unit tests (8 authority, 35 sim), TypeScript, Biome (13 files), browser contract scripts, Vite, and WebGPU with zero shader/validation errors.
- `git diff --check` passed. `p3-t1-protocol-red`, `p3-t1-map-red`, and `p3-t1-contract` were each stopped with `down --volumes --remove-orphans`; all associated volumes and networks were removed.
- P3.2 TDD red: `sh container p3-t2-authority-red run --rm dev cargo test -p th-sim objective_ -- --nocapture` failed as expected: 3 passed, 3 failed. The failures proved a valid theft was not secured and door plus extraction incorrectly won without theft. The second red run after adjusting existing win fixtures gave the same result.
- P3.2 focused green: `sh container p3-t2-authority run --rm dev cargo test -p th-sim objective_ -- --nocapture` passed 6 tests. `cargo fmt --all --check` and workspace Clippy with `-D warnings` passed.
- P3.2 workspace `cargo test --workspace` passed 8 authority and 39 sim tests, plus zero-test protocol and doc targets. `sh container p3-t2-authority verify` passed codegen/protocol, the same Rust checks, TypeScript/Biome, browser contract scripts, Vite build, and WebGPU with zero shader or validation errors. `git diff --check` passed.
- `p3-t2-authority-red` and `p3-t2-authority` both completed `down --volumes --remove-orphans`; their networks and volumes were removed.
- P3.3 TDD red: `sh container p3-t3-objective-red run --rm dev node apps/web/test/objective-view.mjs` failed with `ERR_MODULE_NOT_FOUND` for the new pure view. `sh container p3-t3-hud-red run --rm dev node apps/web/test/room-hud.mjs` failed because the active objective still read “Open the final door with Echo Presence.” `sh container p3-t3-audio-red run --rm dev node apps/web/test/audio.mjs` failed because the secured edge returned no cue.
- P3.3 focused green: `sh container p3-t3-client run --rm dev sh -lc 'node apps/web/test/objective-view.mjs && node apps/web/test/room-hud.mjs && node apps/web/test/presentation-view.mjs && node apps/web/test/audio.mjs'` passed all four scripts.
- P3.3 full gate: the first `sh container p3-t3-client verify` passed Rust Clippy and 47 Rust tests, then caught a TypeScript target-list inference error. After fixing the shared target type, the second run passed codegen/protocol, Rust format/Clippy and 47 tests, TypeScript, Biome (14 files), all pure/browser contracts, Vite, and raw WebGPU (0 shader/validation errors). A final type-only rename was checked with `sh container p3-t3-final run --rm dev sh -lc 'npm ci >/dev/null && npx tsc -p apps/web/tsconfig.json && npx biome check apps/web/src && node apps/web/test/objective-view.mjs && node apps/web/test/room-hud.mjs && node apps/web/test/presentation-view.mjs && node apps/web/test/audio.mjs'`.
- `git diff --check` passed. `p3-t3-objective-red`, `p3-t3-hud-red`, `p3-t3-audio-red`, `p3-t3-client`, and `p3-t3-final` were stopped with `down --volumes --remove-orphans`; all associated networks and volumes were removed.
- P3.3 review fix: `sh container p3-t3-review-red run --rm dev node apps/web/test/audio.mjs` failed as expected because ACTIVE unsecured → FAILED secured emitted only `failure`. After removing phase gating from the secured edge, `sh container p3-t3-review run --rm dev sh -lc 'npm ci >/dev/null && node apps/web/test/audio.mjs && npx tsc -p apps/web/tsconfig.json && npx biome check apps/web/src'` passed the audio test, TypeScript, and Biome (14 files). Both review namespaces were stopped with `down --volumes --remove-orphans`.

## Next action

P3.4 is implemented on `p3/full-mission-e2e`; serial release gates passed and
clean-worktree isolation is next.

- TDD red: `sh container p3-t4-e2e-red acceptance` exited 1 at the expected
  missing-theft victory gate. At tick 13386 both humans were in extraction,
  `echoOpenedFinalDoor` was true, and the room stayed ACTIVE with
  `objectiveSecured` false. The original route timed out waiting for WON.
- Screenshot TDD red: `sh container p3-t4-screenshot-red run --rm dev sh -lc
  'npm ci >/dev/null && node tests/screenshot-contract.mjs'` exited 1 because the
  old PNG validator accepted a missing objective (`Missing expected rejection`).
- Red logs and failure JSON were copied to the ignored
  `.superpowers/sdd/2026-09-23-vault-data-heist/artifacts/` directory. Both red
  namespaces completed `down --volumes --remove-orphans` before release checks.
- `sh container p3-t4-release verify` passed codegen/protocol compatibility,
  Rust formatting/Clippy and 47 unit tests (8 authority, 39 sim), TypeScript,
  Biome (14 files), all browser contracts including objective PNG validation,
  Vite, and WebGPU with 0 shader errors and no validation errors.
- The first `sh container p3-t4-release acceptance` secured data at matching
  client tick 10170 and captured the two dim-terminal screenshots, then exposed
  a route failure: at tick 10733 guard 51's return cone caught the human on the
  final plate. Preserved `first-green-failure.{json,log}`. The route now waits
  outside guard range for its crossing/vault Echo history to clear and the
  guard to resume patrol before recording plate 23. The corrected run follows.
- Corrected `sh container p3-t4-release acceptance` passed. Room epoch
  `p3-t4-release-18d7dd6f24f35a70-1-0`: guard agreement tick 9894 with source 9294
  (delta 600); out-of-range action rejected from tick 8826; both clients secured
  target 61 at shared tick 10353 after player 1's authoritative pose
  `(20892, 3933)` at tick 10350. The completed approach replay cleared at 11076
  (source 10476). Plate 23 had Echo-only presence at tick 12375 with source 11775
  (delta 600). Both humans won at tick 12501; restart at 12579 cleared the
  objective and restored the cyan terminal. Camera 41 then failed attempt 3 at
  tick 13894; final clean lobby attempt 4 was observed at tick 13974.
- `sh container p3-t4-release visual` passed both separate Chromium services.
  Ephemeral loopback CDP ports were 55096/55095. Both clients reported raw
  `webgpu`, Google SwiftShader fallback adapter, `rgba8unorm`; all renderer and
  browser error arrays were empty. CDP SystemInfo confirmed ANGLE Vulkan
  1.4.318 with Mesa llvmpipe 25.2.8 / LLVM 20.1.2, GaneshVulkan compositor.
- Copied and visually inspected all 14 mission PNGs and 2 visual PNGs at
  1280×720, device scale 1. Both objective-secured images contain floor, wall,
  guard, dim terminal `[26,76,87,255]`, and “Open the final door with Echo
  Presence.” Initial and reset images show the cyan terminal
  `[20,230,255,255]`; win, guard failure, camera failure, and restart HUDs match
  authority state. Screenshot count remains 14 for acceptance.
- Copied canonical acceptance JSON, visual metadata, GPU information, and logs
  under `.superpowers/sdd/2026-09-23-vault-data-heist/artifacts/` before
  `sh container p3-t4-release down --volumes --remove-orphans`.
